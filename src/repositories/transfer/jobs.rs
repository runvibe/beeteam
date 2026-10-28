//! Durable local job journal and process-wide OS leases, separate from portable data.
use crate::dto::data_transfer::Job;
use anyhow::{ensure, Context, Result};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::PathBuf,
};
use uuid::Uuid;

pub struct Lease(File);
impl Drop for Lease {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.0);
    }
}
#[derive(Clone)]
pub struct JobStore {
    root: PathBuf,
}
#[derive(Debug, thiserror::Error)]
#[error("transfer_busy")]
pub struct Busy {
    pub active_job: Option<Uuid>,
}
#[derive(Serialize, Deserialize)]
struct Replay {
    operation: String,
    fingerprint: String,
    job: Uuid,
}
impl JobStore {
    pub fn new(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(root.join("jobs"))?;
        fs::create_dir_all(root.join("keys"))?;
        Ok(Self { root })
    }
    fn lock(&self, name: &str) -> Result<Lease> {
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(self.root.join(name))?;
        file.try_lock_exclusive().context("transfer_busy")?;
        Ok(Lease(file))
    }
    pub fn lease(&self) -> Result<Lease> {
        self.lock("heavy.lock").map_err(|_| {
            Busy {
                active_job: self.list().ok().and_then(|jobs| {
                    jobs.into_iter()
                        .find(|j| matches!(j.state.as_str(), "queued" | "running" | "restoring"))
                        .map(|j| j.id)
                }),
            }
            .into()
        })
    }
    pub async fn transaction(&self) -> Result<Lease> {
        let path = self.root.join("journal.lock");
        tokio::task::spawn_blocking(move || -> Result<Lease> {
            let file = OpenOptions::new()
                .create(true)
                .truncate(false)
                .read(true)
                .write(true)
                .open(path)?;
            FileExt::lock_exclusive(&file)?;
            Ok(Lease(file))
        })
        .await?
    }
    fn atomic(&self, path: PathBuf, value: &impl Serialize) -> Result<()> {
        let tmp = path.with_extension(format!("{}.tmp", Uuid::new_v4()));
        let mut file = OpenOptions::new().create_new(true).write(true).open(&tmp)?;
        serde_json::to_writer(&mut file, value)?;
        file.flush()?;
        file.sync_all()?;
        fs::rename(tmp, path)?;
        Ok(())
    }
    pub fn save(&self, job: &Job) -> Result<()> {
        self.atomic(self.root.join("jobs").join(format!("{}.json", job.id)), job)
    }
    pub fn get(&self, id: Uuid) -> Result<Job> {
        Ok(serde_json::from_reader(
            File::open(self.root.join("jobs").join(format!("{id}.json")))
                .context("job_not_found")?,
        )?)
    }
    pub fn list(&self) -> Result<Vec<Job>> {
        let mut jobs = Vec::new();
        for entry in fs::read_dir(self.root.join("jobs"))? {
            let path = entry?.path();
            if path.extension().is_some_and(|v| v == "json") {
                jobs.push(serde_json::from_reader(File::open(path)?)?);
            }
        }
        Ok(jobs)
    }
    pub fn replay(&self, key: Uuid, operation: &str, fingerprint: &str) -> Result<Option<Job>> {
        let path = self.root.join("keys").join(format!("{key}.json"));
        if !path.exists() {
            return Ok(None);
        }
        let value: Replay = serde_json::from_reader(File::open(path)?)?;
        ensure!(
            value.operation == operation && value.fingerprint == fingerprint,
            "idempotency_conflict"
        );
        Ok(Some(self.get(value.job)?))
    }
    pub fn remember(&self, key: Uuid, operation: &str, fingerprint: &str, job: Uuid) -> Result<()> {
        self.atomic(
            self.root.join("keys").join(format!("{key}.json")),
            &Replay {
                operation: operation.into(),
                fingerprint: fingerprint.into(),
                job,
            },
        )
    }
}
