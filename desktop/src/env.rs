use std::path::Path;

/// Loads optional desktop configuration. Existing process variables win.
pub fn load_desktop_env(path: &Path) -> anyhow::Result<bool> {
    match dotenvy::from_path(path) {
        Ok(()) => Ok(true),
        Err(dotenvy::Error::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(anyhow::anyhow!("Cannot load {}: {e}", path.display())),
    }
}

#[cfg(test)]
mod tests {
    use super::load_desktop_env;

    #[test]
    fn missing_file_is_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!load_desktop_env(&dir.path().join("desktop.env")).unwrap());
    }

    #[test]
    fn loads_values_without_overriding_process_env() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("desktop.env");
        std::fs::write(
            &path,
            "BEE_DESKTOP_TEST_NEW=from-file\nBEE_DESKTOP_TEST_KEEP=from-file\n",
        )
        .unwrap();
        unsafe { std::env::set_var("BEE_DESKTOP_TEST_KEEP", "from-process") };
        assert!(load_desktop_env(&path).unwrap());
        assert_eq!(std::env::var("BEE_DESKTOP_TEST_NEW").unwrap(), "from-file");
        assert_eq!(
            std::env::var("BEE_DESKTOP_TEST_KEEP").unwrap(),
            "from-process"
        );
    }

    #[test]
    fn malformed_file_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("desktop.env");
        std::fs::write(&path, "NOT VALID LINE WITHOUT EQUALS'\n").unwrap();
        assert!(load_desktop_env(&path).is_err());
    }
}
