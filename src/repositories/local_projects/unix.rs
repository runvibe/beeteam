use super::*;
use crate::dto::backend::Result;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub(super) struct LaunchPlan {
    executable: &'static str,
    arguments: Vec<PathBuf>,
}

pub(super) fn prepare(root: &str, application: ProjectApplication) -> Result<LaunchPlan> {
    if !Path::new(root).is_absolute() || root.chars().any(char::is_control) {
        return Err(Failure::new(
            "local_path_invalid",
            "An absolute project directory is required.",
        ));
    }
    let folder = std::fs::canonicalize(root)
        .ok()
        .filter(|p| p.is_dir())
        .ok_or_else(|| {
            Failure::new(
                "project_folder_unavailable",
                "The project directory is unavailable on this computer.",
            )
        })?;
    let (candidates, mut arguments): (&[&str], Vec<PathBuf>) = match application {
        #[cfg(target_os = "macos")]
        ProjectApplication::Explorer => (&["/usr/bin/open"], vec![]),
        #[cfg(target_os = "macos")]
        ProjectApplication::Vscode => (
            &["/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"],
            vec!["--new-window".into()],
        ),
        #[cfg(target_os = "linux")]
        ProjectApplication::Explorer => (&["/usr/bin/xdg-open"], vec![]),
        #[cfg(target_os = "linux")]
        ProjectApplication::Vscode => (
            &["/usr/bin/code", "/snap/bin/code"],
            vec!["--new-window".into()],
        ),
    };
    let executable = candidates
        .iter()
        .copied()
        .find(|path| Path::new(path).is_file())
        .ok_or_else(|| {
            Failure::new(
                "local_application_unavailable",
                "The selected application is unavailable.",
            )
        })?;
    arguments.push(folder);
    Ok(LaunchPlan {
        executable,
        arguments,
    })
}

pub(super) fn launch(plan: LaunchPlan) -> Result<()> {
    let mut child = Command::new(plan.executable)
        .args(plan.arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| {
            Failure::new(
                "local_launch_failed",
                "Could not start the selected application.",
            )
        })?;
    std::thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_relative_paths_and_preserves_spaces_as_one_argument() {
        assert!(prepare("relative", ProjectApplication::Explorer).is_err());
        let root = tempfile::tempdir().unwrap();
        let folder = root.path().join("project & literal");
        std::fs::create_dir(&folder).unwrap();
        let plan = prepare(folder.to_str().unwrap(), ProjectApplication::Explorer).unwrap();
        assert_eq!(plan.arguments, [std::fs::canonicalize(folder).unwrap()]);
    }
}
