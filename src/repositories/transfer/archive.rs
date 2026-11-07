//! Bounded portable archive codec. All filesystem paths are derived from internal UUIDs.
use crate::{
    dto::data_transfer::{Entry, Manifest},
    repositories::records::TABLES,
};
use anyhow::{ensure, Context, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File, OpenOptions},
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};
pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
pub const CHUNK: usize = 64 * 1024;
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    pub compressed: u64,
    pub expanded: u64,
    pub entries: usize,
    pub line: usize,
    pub seconds: u64,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            compressed: 2 * 1024 * 1024 * 1024,
            expanded: 10 * 1024 * 1024 * 1024,
            entries: 100_000,
            line: 1024 * 1024,
            seconds: 1800,
        }
    }
}
#[derive(Clone)]
pub struct ArchiveStore {
    root: PathBuf,
    pub limits: Limits,
}
// Archives predating explicit execution tracking contain none of these groups.
const INTERVAL_GROUPS: &[&str] = &["task_executions","task_execution_intervals","task_execution_interval_counters","task_execution_tracking_events","task_execution_interval_revisions"];
pub fn groups() -> Vec<&'static str> {
    TABLES
        .iter()
        .copied()
        .chain(["file_contents", "request_replays"])
        .collect()
}
fn allowed(name: &str) -> bool {
    if groups()
        .iter()
        .any(|t| name == format!("records/{t}.jsonl"))
    {
        return true;
    }
    name.strip_prefix("blobs/")
        .and_then(|s| s.strip_suffix(".bin"))
        .and_then(|s| {
            Uuid::parse_str(s)
                .ok()
                .filter(|id| id.get_version_num() == 7 && id.to_string() == s)
        })
        .is_some()
}
fn hash_file(path: &Path, mut check: impl FnMut() -> Result<()>) -> Result<(u64, String)> {
    let mut file = File::open(path)?;
    let mut hash = Sha256::new();
    let mut buf = [0; CHUNK];
    let mut n = 0;
    loop {
        check()?;
        let count = file.read(&mut buf)?;
        if count == 0 {
            break;
        }
        hash.update(&buf[..count]);
        n += count as u64;
    }
    Ok((n, hex(&hash.finalize())))
}
impl ArchiveStore {
    pub fn new(root: PathBuf, limits: Limits) -> Result<Self> {
        fs::create_dir_all(&root)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&root, fs::Permissions::from_mode(0o700))?;
        }
        Ok(Self { root, limits })
    }
    pub fn ensure_space(&self, bytes: u64) -> Result<()> {
        ensure!(
            fs2::available_space(&self.root)? >= bytes.saturating_add(16 * 1024 * 1024),
            "insufficient_disk_space"
        );
        Ok(())
    }
    pub fn size(&self, id: Uuid) -> Result<u64> {
        Ok(self.archive_path(id).metadata()?.len())
    }
    pub fn directory(&self, id: Uuid) -> PathBuf {
        self.root.join(id.to_string())
    }
    pub fn archive_path(&self, id: Uuid) -> PathBuf {
        self.directory(id).join("archive.beeteam.zip")
    }
    pub fn data_dir(&self, id: Uuid) -> PathBuf {
        let root = self.directory(id);
        if root.join("validated").exists() {
            root.join("verified")
        } else {
            root.join("stage")
        }
    }
    pub fn create_stage(&self, id: Uuid) -> Result<()> {
        self.start_clock(id)?;
        let dir = self.directory(id).join("stage");
        fs::create_dir_all(dir.join("records"))?;
        fs::create_dir_all(dir.join("blobs"))?;
        for t in groups() {
            OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(dir.join(format!("records/{t}.jsonl")))?;
        }
        Ok(())
    }
    pub fn append(&self, id: Uuid, name: &str, value: &Value) -> Result<()> {
        ensure!(
            allowed(name) && name.starts_with("records/"),
            "invalid_entry"
        );
        let mut line = serde_json::to_vec(value)?;
        ensure!(line.len() <= self.limits.line, "line_limit");
        line.push(b'\n');
        self.ensure_space(line.len() as u64)?;
        OpenOptions::new()
            .append(true)
            .open(self.directory(id).join("stage").join(name))?
            .write_all(&line)?;
        Ok(())
    }
    pub fn blob_writer(&self, id: Uuid, blob: Uuid) -> Result<File> {
        ensure!(blob.get_version_num() == 7, "invalid_uuid");
        Ok(OpenOptions::new().create_new(true).write(true).open(
            self.directory(id)
                .join("stage/blobs")
                .join(format!("{blob}.bin")),
        )?)
    }
    pub fn write_blob(&self, id: Uuid, blob: Uuid, bytes: &[u8]) -> Result<()> {
        self.blob_writer(id, blob)?.write_all(bytes)?;
        Ok(())
    }
    pub fn blob_reader(&self, id: Uuid, blob: Uuid) -> Result<File> {
        Ok(File::open(
            self.data_dir(id).join("blobs").join(format!("{blob}.bin")),
        )?)
    }
    pub fn row_iter(&self, id: Uuid, group: &str) -> Result<Rows> {
        ensure!(groups().contains(&group), "invalid_group");
        Ok(Rows {
            reader: BufReader::new(File::open(
                self.data_dir(id).join(format!("records/{group}.jsonl")),
            )?),
            limit: self.limits.line,
        })
    }
    pub fn rows(&self, id: Uuid, group: &str) -> Result<Vec<Value>> {
        self.row_iter(id, group)?.collect()
    }
    pub fn start_clock(&self, id: Uuid) -> Result<()> {
        fs::create_dir_all(self.directory(id))?;
        fs::write(
            self.directory(id).join("started"),
            chrono::Utc::now().timestamp().to_string(),
        )?;
        Ok(())
    }
    pub fn check(&self, id: Uuid, started: std::time::Instant) -> Result<()> {
        let path = self.directory(id).join("started");
        if path.exists() {
            let epoch: i64 = fs::read_to_string(path)?.parse()?;
            ensure!(
                chrono::Utc::now().timestamp().saturating_sub(epoch) < self.limits.seconds as i64,
                "transfer_timeout"
            );
        }
        ensure!(
            started.elapsed().as_secs() < self.limits.seconds,
            "transfer_timeout"
        );
        ensure!(!self.directory(id).join("cancel").exists(), "cancelled");
        Ok(())
    }
    pub fn cancel(&self, id: Uuid) -> Result<()> {
        fs::create_dir_all(self.directory(id))?;
        fs::write(self.directory(id).join("cancel"), b"cancel")?;
        Ok(())
    }
    pub fn progress(&self, id: Uuid, stage: &str, records: u64) -> Result<()> {
        let path = self.directory(id).join("progress.json");
        let tmp = path.with_extension("tmp");
        fs::write(
            &tmp,
            serde_json::to_vec(&serde_json::json!({"stage":stage,"records":records}))?,
        )?;
        fs::rename(tmp, path)?;
        Ok(())
    }
    pub fn read_progress(&self, id: Uuid) -> Result<Option<(String, u64)>> {
        let path = self.directory(id).join("progress.json");
        if !path.exists() {
            return Ok(None);
        }
        let value: Value = serde_json::from_reader(File::open(path)?)?;
        Ok(Some((
            value["stage"].as_str().unwrap_or_default().into(),
            value["records"].as_u64().unwrap_or_default(),
        )))
    }
    pub fn seal(&self, id: Uuid, driver: &str, floor: i64) -> Result<Manifest> {
        self.seal_at(id, driver, floor, chrono::Utc::now().to_rfc3339())
    }
    pub fn seal_at(
        &self,
        id: Uuid,
        driver: &str,
        floor: i64,
        snapshot_at: String,
    ) -> Result<Manifest> {
        let started = std::time::Instant::now();
        let dir = self.directory(id).join("stage");
        let mut entries = BTreeMap::new();
        let mut total = 0_u64;
        for sub in ["records", "blobs"] {
            for item in fs::read_dir(dir.join(sub))? {
                self.check(id, started)?;
                let item = item?;
                let name = format!(
                    "{sub}/{}",
                    item.file_name().to_str().context("invalid filename")?
                );
                ensure!(allowed(&name), "invalid_entry");
                let (bytes, sha256) = hash_file(&item.path(), || self.check(id, started))?;
                total += bytes;
                ensure!(total <= self.limits.expanded, "expanded_limit");
                let rows = if sub == "records" {
                    Some(
                        self.row_iter(
                            id,
                            name.trim_start_matches("records/")
                                .trim_end_matches(".jsonl"),
                        )?
                        .try_fold(0, |n, r| {
                            self.check(id, started)?;
                            r.map(|_| n + 1)
                        })?,
                    )
                } else {
                    None
                };
                entries.insert(
                    name,
                    Entry {
                        bytes,
                        sha256,
                        rows,
                    },
                );
            }
        }
        ensure!(entries.len() + 1 <= self.limits.entries, "entry_limit");
        let manifest = Manifest {
            format_version: 1,
            archive_id: id,
            application_version: env!("CARGO_PKG_VERSION").into(),
            source_driver: driver.into(),
            snapshot_at,
            sequence_floor: floor,
            entries,
        };
        self.ensure_space(total.saturating_add(1024 * 1024))?;
        let tmp = self.directory(id).join("archive.partial");
        let mut zip = ZipWriter::new(File::create(&tmp)?);
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Stored)
            .large_file(true);
        zip.start_file("manifest.json", options)?;
        zip.write_all(&serde_json::to_vec(&manifest)?)?;
        for name in manifest.entries.keys() {
            zip.start_file(name, options)?;
            let mut input = File::open(dir.join(name))?;
            let mut buffer = [0; CHUNK];
            loop {
                self.check(id, started)?;
                let n = input.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                zip.write_all(&buffer[..n])?;
            }
        }
        let output = zip.finish()?;
        output.sync_all()?;
        ensure!(
            output.metadata()?.len() <= self.limits.compressed,
            "compressed_limit"
        );
        drop(output);
        fs::rename(tmp, self.archive_path(id))?;
        self.progress(
            id,
            "archive_ready",
            manifest.entries.values().filter_map(|e| e.rows).sum(),
        )?;
        Ok(manifest)
    }
    pub fn validate_archive(&self, id: Uuid) -> Result<Manifest> {
        let started = std::time::Instant::now();
        let marker = self.directory(id).join("validated");
        if marker.exists() {
            fs::remove_file(marker)?;
        }
        let path = self.archive_path(id);
        ensure!(
            path.metadata()?.len() <= self.limits.compressed,
            "compressed_limit"
        );
        let mut zip = ZipArchive::new(File::open(path)?)?;
        ensure!(zip.len() <= self.limits.entries, "entry_limit");
        let mut seen = BTreeSet::new();
        let mut total = 0_u64;
        for n in 0..zip.len() {
            self.check(id, started)?;
            let f = zip.by_index(n)?;
            let name = f.name();
            ensure!(name == "manifest.json" || allowed(name), "invalid_entry");
            ensure!(seen.insert(name.to_owned()), "duplicate_entry");
            ensure!(
                !f.encrypted() && !f.is_symlink() && f.is_file(),
                "unsupported_entry"
            );
            if let Some(mode) = f.unix_mode() {
                ensure!(
                    mode & 0o170000 == 0 || mode & 0o170000 == 0o100000,
                    "unsupported_entry"
                );
            }
            total = total.checked_add(f.size()).context("expanded_limit")?;
            ensure!(total <= self.limits.expanded, "expanded_limit");
        }
        let mut manifest_bytes = Vec::new();
        zip.by_name("manifest.json")?
            .take(64 * 1024 * 1024 + 1)
            .read_to_end(&mut manifest_bytes)?;
        ensure!(manifest_bytes.len() <= 64 * 1024 * 1024, "manifest_limit");
        let manifest: Manifest = serde_json::from_value(super::json::parse(&manifest_bytes)?)?;
        ensure!(
            manifest.format_version == 1
                && manifest.archive_id.get_version_num() == 7
                && manifest.sequence_floor >= 0,
            "unsupported_manifest"
        );
        let expected: BTreeSet<_> = manifest
            .entries
            .keys()
            .cloned()
            .chain(["manifest.json".into()])
            .collect();
        ensure!(seen == expected, "inventory_mismatch");
        self.ensure_space(total)?;
        let legacy_intervals = INTERVAL_GROUPS.iter().all(|t| !manifest.entries.contains_key(&format!("records/{t}.jsonl")));
        let legacy_session_bindings = !manifest.entries.contains_key("records/agent_session_bindings.jsonl");
        for t in groups() {
            if legacy_session_bindings && t == "agent_session_bindings" { continue; }
            if legacy_intervals && INTERVAL_GROUPS.contains(&t) { continue; }
            ensure!(
                manifest.entries.contains_key(&format!("records/{t}.jsonl")),
                "missing_group"
            );
        }
        let dir = self.directory(id).join("verified");
        fs::create_dir_all(dir.join("records"))?;
        fs::create_dir_all(dir.join("blobs"))?;
        if legacy_session_bindings { File::create(dir.join("records/agent_session_bindings.jsonl"))?; }
        // Normalize only absent additive groups to empty staging files. No rows,
        // evidence, manifest entries or archive bytes are fabricated or rewritten.
        if legacy_intervals {
            for t in INTERVAL_GROUPS { File::create(dir.join(format!("records/{t}.jsonl")))?; }
        }
        let mut actual_total = manifest_bytes.len() as u64;
        for (name, entry) in &manifest.entries {
            ensure!(allowed(name), "invalid_entry");
            let mut input = zip.by_name(name)?;
            let mut output = File::create(dir.join(name))?;
            let mut hash = Sha256::new();
            let mut size = 0;
            let mut buf = [0; CHUNK];
            loop {
                self.check(id, started)?;
                let n = input.read(&mut buf)?;
                if n == 0 {
                    break;
                }
                size += n as u64;
                actual_total += n as u64;
                ensure!(
                    actual_total <= self.limits.expanded && size <= entry.bytes,
                    "expanded_limit"
                );
                hash.update(&buf[..n]);
                output.write_all(&buf[..n])?;
            }
            ensure!(
                size == entry.bytes && hex(&hash.finalize()) == entry.sha256,
                "hash_mismatch"
            );
            if name.starts_with("records/") {
                let rows = Rows {
                    reader: BufReader::new(File::open(dir.join(name))?),
                    limit: self.limits.line,
                }
                .try_fold(0, |n, r| {
                    self.check(id, started)?;
                    r.map(|_| n + 1)
                })?;
                ensure!(entry.rows == Some(rows), "row_count_mismatch");
            }
        }
        fs::write(self.directory(id).join("validated"), b"verified")?;
        Ok(manifest)
    }
    pub fn digest(&self, id: Uuid) -> Result<String> {
        let started = std::time::Instant::now();
        Ok(hash_file(&self.archive_path(id), || self.check(id, started))?.1)
    }
    pub fn upload_file(&self, id: Uuid) -> Result<File> {
        self.start_clock(id)?;
        fs::create_dir_all(self.directory(id))?;
        Ok(OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(self.archive_path(id))?)
    }
    pub fn download_file(&self, id: Uuid) -> Result<tokio::fs::File> {
        Ok(tokio::fs::File::from_std(File::open(
            self.archive_path(id),
        )?))
    }
    pub fn remove_artifacts(&self, id: Uuid) -> Result<()> {
        let dir = self.directory(id);
        if dir.exists() {
            fs::remove_dir_all(dir)?;
        }
        Ok(())
    }
}
pub struct Rows {
    reader: BufReader<File>,
    limit: usize,
}
impl Iterator for Rows {
    type Item = Result<Value>;
    fn next(&mut self) -> Option<Self::Item> {
        let mut buf = Vec::new();
        match self
            .reader
            .by_ref()
            .take(self.limit as u64 + 2)
            .read_until(b'\n', &mut buf)
        {
            Ok(0) => None,
            Ok(_) => Some((|| {
                ensure!(buf.len() <= self.limit + 1, "line_limit");
                ensure!(buf.last() == Some(&b'\n'), "truncated_jsonl");
                super::json::parse(&buf)
            })()),
            Err(e) => Some(Err(e.into())),
        }
    }
}
