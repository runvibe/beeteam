//! Explicit local configuration; no request can select the executable or lease directory.
use std::path::PathBuf;
pub struct ManagedSessionConfig {
    pub installation_id: String,
    pub executable: PathBuf,
    pub state_dir: PathBuf,
}
impl ManagedSessionConfig {
    pub fn from_env() -> anyhow::Result<Option<Self>> {
        let Some(installation) = std::env::var_os("BEE_SESSION_INSTALLATION_ID") else {
            return Ok(None);
        };
        let installation_id = installation.to_string_lossy().trim().to_owned();
        anyhow::ensure!(
            !installation_id.is_empty(),
            "BEE_SESSION_INSTALLATION_ID must not be empty"
        );
        let executable = PathBuf::from(std::env::var("BEE_CODEX_EXECUTABLE")?);
        anyhow::ensure!(
            executable.is_absolute() && executable.is_file(),
            "BEE_CODEX_EXECUTABLE must name an absolute executable file"
        );
        let state_dir = std::env::var_os("BEE_SESSION_STATE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                PathBuf::from(
                    std::env::var_os("USERPROFILE")
                        .or_else(|| std::env::var_os("HOME"))
                        .unwrap_or_default(),
                )
                .join(".beeteam/managed-session-locks")
            });
        anyhow::ensure!(
            state_dir.is_absolute(),
            "Managed session lease directory must be absolute"
        );
        Ok(Some(Self {
            installation_id,
            executable,
            state_dir,
        }))
    }
}
