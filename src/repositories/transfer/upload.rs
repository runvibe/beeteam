use super::archive::ArchiveStore;
use anyhow::{ensure, Result};
use std::{fs::File, io::Write, sync::Arc, time::Instant};
use uuid::Uuid;
pub struct Upload {
    file: File,
    store: Arc<ArchiveStore>,
    id: Uuid,
    bytes: u64,
    started: Instant,
}
impl Upload {
    pub fn check(&self) -> Result<()> {
        self.store.check(self.id, self.started)
    }
    pub fn new(store: Arc<ArchiveStore>, id: Uuid) -> Result<Self> {
        Ok(Self {
            file: store.upload_file(id)?,
            store,
            id,
            bytes: 0,
            started: Instant::now(),
        })
    }
    pub fn append(&mut self, bytes: &[u8]) -> Result<u64> {
        self.store.check(self.id, self.started)?;
        self.store.ensure_space(bytes.len() as u64)?;
        self.bytes = self
            .bytes
            .checked_add(bytes.len() as u64)
            .ok_or_else(|| anyhow::anyhow!("upload_limit"))?;
        ensure!(self.bytes <= self.store.limits.compressed, "upload_limit");
        self.file.write_all(bytes)?;
        Ok(self.bytes)
    }
    pub fn finish(self) -> Result<u64> {
        self.file.sync_all()?;
        Ok(self.bytes)
    }
}
