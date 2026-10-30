use super::{config::TransferConfig, validation};
use crate::{
    dto::data_transfer::{Job, Preview, RestoreRequest, TimestampPolicy},
    repositories::transfer::{
        archive::ArchiveStore,
        contracts::TransferDatabase,
        jobs::{JobStore, Lease},
        upload::Upload,
    },
};
use anyhow::{ensure, Context, Result};
use chrono::{Duration, Utc};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct TransferService {
    database: Arc<dyn TransferDatabase>,
    archive: Arc<ArchiveStore>,
    jobs: JobStore,
    pub config: TransferConfig,
}
pub struct ImportUpload {
    pub job: Job,
    upload: Option<Upload>,
    lease: Option<Lease>,
    service: TransferService,
}
impl ImportUpload {
    pub fn check(&self) -> Result<()> {
        self.upload.as_ref().context("upload_closed")?.check()
    }
    pub fn append(&mut self, bytes: &[u8]) -> Result<()> {
        self.job.bytes = self
            .upload
            .as_mut()
            .context("upload_closed")?
            .append(bytes)?;
        Ok(())
    }
    pub async fn finish(mut self) -> Result<Job> {
        self.upload.take().context("upload_closed")?.finish()?;
        let _journal = self.service.jobs.transaction().await?;
        self.job.cancel_requested = self.service.jobs.get(self.job.id)?.cancel_requested;
        self.job.state = "running".into();
        self.job.stage = "validating".into();
        self.service.jobs.save(&self.job)?;
        let service = self.service.clone();
        let job = self.job.clone();
        let lease = self.lease.take().context("lease_closed")?;
        tokio::spawn(async move {
            let _lease = lease;
            let result = service.validate(job.id).await;
            service.finish(job.id, result, false).await;
        });
        Ok(self.job.clone())
    }
}
impl Drop for ImportUpload {
    fn drop(&mut self) {
        if let Some(lease) = self.lease.take() {
            let service = self.service.clone();
            let id = self.job.id;
            tokio::spawn(async move {
                let _lease = lease;
                service
                    .finish(id, Err(anyhow::anyhow!("upload_interrupted")), false)
                    .await;
            });
        }
    }
}
impl TransferService {
    pub fn new(database: Arc<dyn TransferDatabase>, config: TransferConfig) -> Result<Self> {
        let archive = Arc::new(ArchiveStore::new(
            config.directory.clone(),
            config.limits.clone(),
        )?);
        let jobs = JobStore::new(config.directory.clone())?;
        Ok(Self {
            database,
            archive,
            jobs,
            config,
        })
    }
    pub fn info(&self) -> Value {
        json!({"enabled":self.config.enabled,"limits":self.config.limits,"retentionSeconds":self.config.retention_seconds})
    }
    fn enabled(&self) -> Result<()> {
        ensure!(self.config.enabled, "transfer_disabled");
        Ok(())
    }
    pub fn origin_allowed(&self, origin: Option<&str>) -> bool {
        origin.is_none_or(|v| self.config.origins.iter().any(|o| o == v))
    }
    pub async fn recover(&self) -> Result<()> {
        let Ok(_lease) = self.jobs.lease() else {
            return Ok(());
        };
        let _journal = self.jobs.transaction().await?;
        for mut job in self.jobs.list()? {
            if matches!(job.state.as_str(), "queued" | "running" | "restoring") {
                if job.kind == "import" && self.database.committed(job.id).await? {
                    job.state = "completed".into();
                    job.error = None;
                    job.result = Some(json!({"restored":true,"recovered":true}));
                } else {
                    job.state = if job.cancel_requested {
                        "cancelled"
                    } else {
                        "failed"
                    }
                    .into();
                    job.error = Some("process_interrupted".into());
                }
                job.updated_at = Utc::now().to_rfc3339();
                self.jobs.save(&job)?;
            }
            if matches!(
                job.state.as_str(),
                "ready" | "completed" | "failed" | "cancelled"
            ) && chrono::DateTime::parse_from_rfc3339(&job.updated_at)?
                + Duration::seconds(self.config.retention_seconds)
                < Utc::now()
            {
                self.archive.remove_artifacts(job.id)?;
                job.state = "expired".into();
                job.preview = None;
                self.jobs.save(&job)?;
            }
        }
        Ok(())
    }
    pub async fn status(&self, id: Uuid) -> Result<Job> {
        self.enabled()?;
        // Keep the durable state readable while an uncertain DB outcome is pending.
        // New mutations still require successful recovery before acquiring a lease.
        let _ = self.recover().await;
        let mut job = self.jobs.get(id)?;
        if matches!(job.state.as_str(), "running" | "restoring") {
            if let Some((stage, records)) = self.archive.read_progress(id)? {
                job.stage = stage;
                job.records = records;
            }
        }
        Ok(job)
    }
    fn new_job(&self, kind: &str) -> Job {
        let now = Utc::now().to_rfc3339();
        Job {
            id: Uuid::now_v7(),
            kind: kind.into(),
            state: "queued".into(),
            stage: "queued".into(),
            bytes: 0,
            records: 0,
            created_at: now.clone(),
            updated_at: now,
            error: None,
            archive_sha256: None,
            preview: None,
            result: None,
            cancel_requested: false,
        }
    }
    pub async fn export(&self, key: Uuid) -> Result<Job> {
        self.enabled()?;
        self.recover().await?;
        let _journal = self.jobs.transaction().await?;
        if let Some(job) = self.jobs.replay(key, "export", "")? {
            return Ok(job);
        }
        let lease = self.jobs.lease()?;
        let mut job = self.new_job("export");
        job.state = "running".into();
        job.stage = "snapshot".into();
        self.jobs.save(&job)?;
        self.jobs.remember(key, "export", "", job.id)?;
        let service = self.clone();
        let id = job.id;
        tokio::spawn(async move {
            let _lease = lease;
            let result = service
                .database
                .export(service.archive.clone(), id)
                .await
                .map(|_| ());
            service.finish(id, result, false).await;
        });
        Ok(job)
    }
    pub async fn begin_import(
        &self,
        key: Uuid,
        hash: &str,
    ) -> Result<std::result::Result<ImportUpload, Job>> {
        self.enabled()?;
        ensure!(
            hash.len() == 64
                && hash
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "invalid_archive_hash"
        );
        self.recover().await?;
        let _journal = self.jobs.transaction().await?;
        if let Some(job) = self.jobs.replay(key, "import", hash)? {
            return Ok(Err(job));
        }
        let lease = self.jobs.lease()?;
        let mut job = self.new_job("import");
        job.state = "running".into();
        job.stage = "upload".into();
        job.archive_sha256 = Some(hash.into());
        self.jobs.save(&job)?;
        self.jobs.remember(key, "import", hash, job.id)?;
        let upload = Upload::new(self.archive.clone(), job.id)?;
        Ok(Ok(ImportUpload {
            job,
            upload: Some(upload),
            lease: Some(lease),
            service: self.clone(),
        }))
    }
    async fn validate(&self, id: Uuid) -> Result<()> {
        let destination = self.database.destination().await?;
        let archive = self.archive.clone();
        let driver = destination.driver.clone();
        let (manifest, hash, precision) = tokio::task::spawn_blocking(move || -> Result<_> {
            let manifest = archive.validate_archive(id)?;
            let hash = archive.digest(id)?;
            let precision = validation::inspect(&archive, id, &manifest, &driver)?;
            Ok((manifest, hash, precision))
        })
        .await??;
        let _journal = self.jobs.transaction().await?;
        let mut job = self.jobs.get(id)?;
        ensure!(
            job.archive_sha256.as_deref() == Some(&hash),
            "archive_hash_mismatch"
        );
        job.records = manifest.entries.values().filter_map(|e| e.rows).sum();
        job.preview = Some(Preview {
            manifest,
            archive_sha256: hash,
            destination_id: destination.id,
            destination_driver: destination.driver,
            destination_empty: destination.empty,
            precision_changes: precision,
            confirmation_token: Uuid::now_v7(),
            expires_at: (Utc::now() + Duration::seconds(self.config.retention_seconds))
                .to_rfc3339(),
            warnings: vec![
                "Includes deleted records, attachments and historical replay responses.".into(),
            ],
        });
        self.jobs.save(&job)?;
        Ok(())
    }
    pub async fn restore(&self, id: Uuid, key: Uuid, request: RestoreRequest) -> Result<Job> {
        self.enabled()?;
        self.recover().await?;
        let fingerprint = serde_json::to_string(&json!({"id":id,"request":request}))?;
        let _journal = self.jobs.transaction().await?;
        if let Some(job) = self.jobs.replay(key, "restore", &fingerprint)? {
            return Ok(job);
        }
        let lease = self.jobs.lease()?;
        let mut job = self.jobs.get(id)?;
        ensure!(
            job.kind == "import" && job.state == "ready",
            "import_not_ready"
        );
        let preview = job.preview.as_ref().context("preview_missing")?;
        ensure!(
            preview.confirmation_token == request.confirmation_token
                && preview.archive_sha256 == request.archive_sha256
                && preview.destination_id == request.destination_id,
            "confirmation_mismatch"
        );
        ensure!(
            chrono::DateTime::parse_from_rfc3339(&preview.expires_at)? > Utc::now(),
            "preview_expired"
        );
        ensure!(preview.destination_empty, "destination_not_empty");
        ensure!(
            preview.precision_changes == 0
                || request.timestamp_policy == TimestampPolicy::TruncateToMicroseconds,
            "timestamp_precision_loss"
        );
        let manifest = preview.manifest.clone();
        job.state = "restoring".into();
        job.stage = "restore".into();
        job.updated_at = Utc::now().to_rfc3339();
        self.jobs.save(&job)?;
        self.jobs.remember(key, "restore", &fingerprint, id)?;
        let service = self.clone();
        tokio::spawn(async move {
            let _lease = lease;
            let result = service
                .database
                .restore(
                    service.archive.clone(),
                    id,
                    manifest,
                    request.destination_id,
                    request.timestamp_policy,
                    request.archive_sha256,
                )
                .await;
            service.finish(id, result, true).await;
        });
        Ok(job)
    }
    async fn finish(&self, id: Uuid, mut result: Result<()>, restoring: bool) {
        // A durable DB marker wins over cancellation and any journal failure after commit.
        let committed = if !restoring {
            false
        } else if result.is_ok() {
            true
        } else {
            match self.database.committed(id).await {
                Ok(value) => value,
                Err(_) => {
                    tracing::warn!(job_id=%id,"restore outcome unknown; retaining restoring state for marker reconciliation");
                    return;
                }
            }
        };
        let mut digest = None;
        if result.is_ok() && !restoring {
            let archive = self.archive.clone();
            match tokio::task::spawn_blocking(move || archive.digest(id)).await {
                Ok(Ok(hash)) => digest = Some(hash),
                Ok(Err(e)) => result = Err(e),
                Err(e) => result = Err(e.into()),
            }
        }
        let result = async {
            let _journal = self.jobs.transaction().await?;
            let mut job = self.jobs.get(id)?;
            if committed {
                job.state = "completed".into();
                job.error = None;
                job.result = Some(json!({"restored":true}));
            } else if let Err(error) = result {
                job.state = if job.cancel_requested {
                    "cancelled"
                } else {
                    "failed"
                }
                .into();
                job.error = Some(public_error(&error));
            } else if job.cancel_requested {
                job.state = "cancelled".into();
            } else {
                job.state = "ready".into();
                job.bytes = self.archive.size(id)?;
                if job.kind == "export" {
                    if let Some((_, records)) = self.archive.read_progress(id)? {
                        job.records = records;
                    }
                }
                job.archive_sha256 = digest;
            }
            job.stage = job.state.clone();
            job.updated_at = Utc::now().to_rfc3339();
            self.jobs.save(&job)
        }
        .await;
        if result.is_err() {
            tracing::error!(job_id=%id,"transfer journal update failed; recovery required");
        }
    }
    pub async fn cancel(&self, id: Uuid, key: Uuid) -> Result<Job> {
        self.enabled()?;
        self.recover().await?;
        let _journal = self.jobs.transaction().await?;
        let fingerprint = id.to_string();
        if let Some(job) = self.jobs.replay(key, "cancel", &fingerprint)? {
            return Ok(job);
        }
        let mut job = self.jobs.get(id)?;
        if !matches!(
            job.state.as_str(),
            "completed" | "failed" | "cancelled" | "expired"
        ) {
            self.archive.cancel(id)?;
            job.cancel_requested = true;
            if job.state == "ready" {
                job.state = "cancelled".into();
            }
            job.stage = job.state.clone();
            job.updated_at = Utc::now().to_rfc3339();
            self.jobs.save(&job)?;
        }
        self.jobs.remember(key, "cancel", &fingerprint, id)?;
        Ok(job)
    }
    pub async fn download(&self, id: Uuid) -> Result<tokio::fs::File> {
        let job = self.status(id).await?;
        ensure!(
            job.kind == "export" && job.state == "ready",
            "export_not_ready"
        );
        self.archive.download_file(id)
    }
}
pub fn public_error(error: &anyhow::Error) -> String {
    let message = error.to_string();
    if message.len() < 100 && message.bytes().all(|b| b.is_ascii_lowercase() || b == b'_') {
        message
    } else {
        "transfer_failed".into()
    }
}

#[cfg(test)]
mod recovery_tests {
    use super::*;
    use crate::dto::data_transfer::Manifest;
    use crate::repositories::transfer::contracts::{Destination, TransferFuture};
    use std::sync::atomic::{AtomicBool, Ordering};
    struct UncertainCommit(AtomicBool);
    impl TransferDatabase for UncertainCommit {
        fn destination(&self) -> TransferFuture<'_, Destination> {
            Box::pin(async { unreachable!() })
        }
        fn export(&self, _: Arc<ArchiveStore>, _: Uuid) -> TransferFuture<'_, Manifest> {
            Box::pin(async { unreachable!() })
        }
        fn restore(
            &self,
            _: Arc<ArchiveStore>,
            _: Uuid,
            _: Manifest,
            _: Uuid,
            _: TimestampPolicy,
            _: String,
        ) -> TransferFuture<'_, ()> {
            Box::pin(async { unreachable!() })
        }
        fn committed(&self, _: Uuid) -> TransferFuture<'_, bool> {
            Box::pin(async move {
                if self.0.swap(false, Ordering::SeqCst) {
                    anyhow::bail!("connection_unavailable")
                }
                Ok(true)
            })
        }
    }
    fn service(dir: &std::path::Path) -> TransferService {
        TransferService::new(
            Arc::new(UncertainCommit(AtomicBool::new(true))),
            TransferConfig {
                enabled: true,
                directory: dir.into(),
                origins: vec![],
                limits: Default::default(),
                retention_seconds: 86400,
            },
        )
        .unwrap()
    }
    #[tokio::test]
    async fn uncertain_commit_is_not_marked_failed_before_reconciliation() {
        let dir = tempfile::tempdir().unwrap();
        let service = service(dir.path());
        let mut job = service.new_job("import");
        job.state = "restoring".into();
        service.jobs.save(&job).unwrap();
        service
            .finish(job.id, Err(anyhow::anyhow!("commit_connection_lost")), true)
            .await;
        assert_eq!(service.jobs.get(job.id).unwrap().state, "restoring");
        service.recover().await.unwrap();
        assert_eq!(service.jobs.get(job.id).unwrap().state, "completed");
    }
    #[tokio::test]
    async fn finalization_waits_for_journal_contention() {
        let dir = tempfile::tempdir().unwrap();
        let service = service(dir.path());
        let mut job = service.new_job("import");
        job.state = "restoring".into();
        service.jobs.save(&job).unwrap();
        let guard = service.jobs.transaction().await.unwrap();
        let worker = service.clone();
        let mut completion = tokio::spawn(async move {
            worker.finish(job.id, Ok(()), true).await;
        });
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(50), &mut completion)
                .await
                .is_err()
        );
        drop(guard);
        completion.await.unwrap();
        assert_eq!(service.jobs.get(job.id).unwrap().state, "completed");
    }
}
