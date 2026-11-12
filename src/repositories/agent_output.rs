//! Reads explicitly cited files through a capability rooted in the agent workspace.
use super::integrated_provider::GeneratedFile;
use crate::dto::session_delivery::SessionFailure;
use cap_fs_ext::{DirExt, MetadataExt, OpenOptionsSyncExt};
use cap_std::{
    ambient_authority,
    fs::{Dir, OpenOptions},
};
use std::{
    io::Read,
    path::{Component, Path},
};

const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;

fn unavailable() -> SessionFailure {
    SessionFailure::new("output_unavailable", "Generated file is unavailable", false)
}

pub(super) fn read(root: &str, source: &str) -> Result<GeneratedFile, SessionFailure> {
    let root = Path::new(root);
    let path = Path::new(source);
    let relative = if path.is_absolute() {
        path.strip_prefix(root).map_err(|_| unavailable())?
    } else {
        path
    };
    let mut parts = relative.components();
    if parts.next() != Some(Component::Normal("output".as_ref()))
        || parts.clone().next().is_none()
        || parts.any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(unavailable());
    }
    let name = relative
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(unavailable)?;
    if name.len() > 255 || name.chars().any(char::is_control) {
        return Err(unavailable());
    }
    if !root.is_absolute() {
        return Err(unavailable());
    }
    let parent = root.parent().ok_or_else(unavailable)?;
    let workspace = root.file_name().ok_or_else(unavailable)?;
    let dir = Dir::open_ambient_dir(parent, ambient_authority()).map_err(|_| unavailable())?;
    let dir = dir
        .open_dir_nofollow(workspace)
        .map_err(|_| unavailable())?;
    let dir = dir.open_dir_nofollow("output").map_err(|_| unavailable())?;
    let path = relative.strip_prefix("output").map_err(|_| unavailable())?;
    let mut options = OpenOptions::new();
    options.read(true).nonblock(true);
    let file = dir.open_with(path, &options).map_err(|_| unavailable())?;
    let metadata = file.metadata().map_err(|_| unavailable())?;
    if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES {
        return Err(unavailable());
    }
    if metadata.nlink() != 1 {
        return Err(unavailable());
    }
    let mut bytes = Vec::new();
    file.take(MAX_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| unavailable())?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(unavailable());
    }
    let media_type = if name.to_ascii_lowercase().ends_with(".pdf") && bytes.starts_with(b"%PDF-") {
        "application/pdf"
    } else {
        "application/octet-stream"
    };
    Ok(GeneratedFile {
        name: name.into(),
        media_type,
        bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confines_reads_to_regular_output_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir(root.join("output")).unwrap();
        std::fs::write(root.join("output/report.pdf"), b"%PDF-1.4\n").unwrap();
        std::fs::write(root.join("secret"), b"secret").unwrap();
        let root = root.to_str().unwrap();
        assert_eq!(
            read(root, "output/report.pdf").unwrap().media_type,
            "application/pdf"
        );
        assert!(read(root, "secret").is_err());
        assert!(read(root, "output/../secret").is_err());
        assert!(read(root, "/etc/passwd").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_to_outside_output() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir(root.join("output")).unwrap();
        std::fs::write(root.join("secret"), b"secret").unwrap();
        std::os::unix::fs::symlink("../secret", root.join("output/link")).unwrap();
        let root = root.to_str().unwrap();
        assert!(read(root, "output/link").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_hardlinks_to_outside_output() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir(root.join("output")).unwrap();
        std::fs::write(root.join("secret"), b"secret").unwrap();
        std::fs::hard_link(root.join("secret"), root.join("output/hard")).unwrap();
        let root = root.to_str().unwrap();
        assert!(read(root, "output/hard").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_output_directory_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir(root.join("private")).unwrap();
        std::fs::write(root.join("private/secret"), b"secret").unwrap();
        std::os::unix::fs::symlink("private", root.join("output")).unwrap();
        assert!(read(root.to_str().unwrap(), "output/secret").is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_workspace_directory_symlinks() {
        let parent = tempfile::tempdir().unwrap();
        let real = parent.path().join("real");
        std::fs::create_dir_all(real.join("output")).unwrap();
        std::fs::write(real.join("output/secret"), b"secret").unwrap();
        let link = parent.path().join("workspace");
        std::os::unix::fs::symlink(real, &link).unwrap();
        assert!(read(link.to_str().unwrap(), "output/secret").is_err());
    }

    #[test]
    fn refuses_directories_and_oversized_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir(root.join("output")).unwrap();
        std::fs::create_dir(root.join("output/folder")).unwrap();
        let file = std::fs::File::create(root.join("output/large")).unwrap();
        file.set_len(MAX_FILE_BYTES + 1).unwrap();
        assert!(read(root.to_str().unwrap(), "output/folder").is_err());
        assert!(read(root.to_str().unwrap(), "output/large").is_err());
    }

    #[test]
    fn treats_unverified_pdf_as_a_download_only_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("output")).unwrap();
        std::fs::write(dir.path().join("output/fake.pdf"), b"<html>not a pdf").unwrap();
        assert_eq!(
            read(dir.path().to_str().unwrap(), "output/fake.pdf")
                .unwrap()
                .media_type,
            "application/octet-stream"
        );
    }
}
