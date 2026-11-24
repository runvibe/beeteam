//! OS-backed ownership prevents two dispatchers recovering/sending the same installation.
use fs2::FileExt;
use sha2::{Digest, Sha256};
use std::{
    fs::{File, OpenOptions},
    path::Path,
};
pub struct DispatchLease(File);
impl DispatchLease {
    pub fn acquire(directory: &Path, installation: &str) -> anyhow::Result<Self> {
        std::fs::create_dir_all(directory)?;
        let name = Sha256::digest(installation.as_bytes())
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>();
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(directory.join(format!("{name}.lock")))?;
        file.try_lock_exclusive()?;
        Ok(Self(file))
    }
}
impl Drop for DispatchLease {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.0);
    }
}
