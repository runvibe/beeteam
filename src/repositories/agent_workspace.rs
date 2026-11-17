//! Local filesystem adapter for isolated per-agent working directories.
use crate::dto::session_delivery::SessionFailure;
use std::path::Path;
use uuid::Uuid;

pub fn prepare(agent: Uuid) -> Result<String, SessionFailure> {
    let home = std::env::home_dir().ok_or_else(|| failure("Cannot locate user home"))?;
    prepare_in(&home, agent)
}
fn failure(message: &str) -> SessionFailure {
    SessionFailure::new("workspace_unavailable", message, false)
}
fn prepare_in(home: &Path, agent: Uuid) -> Result<String, SessionFailure> {
    let root = home
        .join(".beeteam")
        .join("workspaces")
        .join(agent.to_string());
    std::fs::create_dir_all(&root).map_err(|_| failure("Cannot create the agent workspace"))?;
    root.to_str()
        .map(str::to_owned)
        .ok_or_else(|| failure("Workspace path is not valid UTF-8"))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn workspaces_are_stable_distinct_and_preserve_files() {
        let home = tempfile::tempdir().unwrap();
        let agent = Uuid::now_v7();
        let first = prepare_in(home.path(), agent).unwrap();
        std::fs::write(Path::new(&first).join("keep.txt"), "existing work").unwrap();
        assert_eq!(prepare_in(home.path(), agent).unwrap(), first);
        assert_ne!(prepare_in(home.path(), Uuid::now_v7()).unwrap(), first);
        assert_eq!(
            std::fs::read_to_string(Path::new(&first).join("keep.txt")).unwrap(),
            "existing work"
        );
        assert!(!Path::new(&first).join("beeteam.sql").exists());
    }
    #[test]
    fn refuses_a_file_instead_of_workspace_directory() {
        let home = tempfile::tempdir().unwrap();
        std::fs::write(home.path().join(".beeteam"), "existing file").unwrap();
        assert!(prepare_in(home.path(), Uuid::now_v7()).is_err());
    }
}
