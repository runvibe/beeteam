use super::contracts::{ProjectOpener, RepositoryFuture};
use crate::dto::{backend::Failure, local_projects::ProjectApplication};

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod unix;
#[cfg(any(target_os = "linux", target_os = "macos"))]
use unix as platform;
#[cfg(windows)]
use windows as platform;

pub struct LocalProjectOpener;
impl ProjectOpener for LocalProjectOpener {
    fn open<'a>(
        &'a self,
        root: &'a str,
        application: ProjectApplication,
    ) -> RepositoryFuture<'a, ()> {
        Box::pin(async move {
            #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
            {
                let _ = (root, application);
                Err(Failure::new(
                    "local_application_unsupported",
                    "A abertura de projetos está indisponível neste sistema.",
                ))
            }
            #[cfg(any(windows, target_os = "linux", target_os = "macos"))]
            {
                let root = root.to_owned();
                // The blocking preparation has no side effects. A timed-out inspection
                // must never launch an application after its caller has given up.
                let plan = tokio::time::timeout(
                    std::time::Duration::from_secs(3),
                    tokio::task::spawn_blocking(move || platform::prepare(&root, application)),
                )
                .await
                .map_err(|_| {
                    Failure::new(
                        "local_inspection_timeout",
                        "A verificação da pasta demorou para responder.",
                    )
                })?
                .map_err(|_| {
                    Failure::new(
                        "local_launch_failed",
                        "Não foi possível preparar a abertura da pasta.",
                    )
                })??;
                platform::launch(plan)
            }
        })
    }
}

#[cfg(windows)]
mod windows {
    use super::*;
    use crate::dto::backend::Result;
    use std::{
        ffi::OsString,
        path::{Component, Path, PathBuf, Prefix},
        process::{Command, Stdio},
    };

    pub(super) struct LaunchPlan {
        executable: PathBuf,
        arguments: Vec<OsString>,
    }
    fn local_drive(path: &Path) -> bool {
        path.is_absolute()
            && matches!(path.components().next(),
            Some(Component::Prefix(p)) if matches!(p.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)))
    }
    fn folder(root: &str) -> Result<PathBuf> {
        if !local_drive(Path::new(root)) || root.chars().any(char::is_control) {
            return Err(Failure::new(
                "local_path_invalid",
                "A abertura exige uma pasta absoluta em um disco local do Windows.",
            ));
        }
        let path = std::fs::canonicalize(root).map_err(|_| {
            Failure::new(
                "project_folder_unavailable",
                "A pasta do projeto não está disponível neste computador.",
            )
        })?;
        if !local_drive(&path) || !path.is_dir() {
            return Err(Failure::new(
                "project_folder_unavailable",
                "O caminho do projeto não é uma pasta local disponível.",
            ));
        }
        let path = path.to_str().ok_or_else(|| {
            Failure::new(
                "local_path_invalid",
                "O caminho da pasta não pode ser representado.",
            )
        })?;
        Ok(PathBuf::from(path.strip_prefix(r"\\?\").unwrap_or(path)))
    }
    fn candidates(application: ProjectApplication) -> Vec<PathBuf> {
        let locations: &[(&str, &str)] = match application {
            ProjectApplication::Explorer => &[("SystemRoot", "explorer.exe")],
            ProjectApplication::Vscode => &[
                ("LOCALAPPDATA", "Programs/Microsoft VS Code/Code.exe"),
                ("ProgramFiles", "Microsoft VS Code/Code.exe"),
                ("ProgramFiles(x86)", "Microsoft VS Code/Code.exe"),
            ],
        };
        locations
            .iter()
            .filter_map(|(name, suffix)| {
                std::env::var_os(name).map(|root| PathBuf::from(root).join(suffix))
            })
            .collect()
    }
    pub(super) fn prepare(root: &str, application: ProjectApplication) -> Result<LaunchPlan> {
        prepare_from(root, application, candidates(application))
    }
    fn prepare_from(
        root: &str,
        application: ProjectApplication,
        executables: Vec<PathBuf>,
    ) -> Result<LaunchPlan> {
        let folder = folder(root)?;
        let executable = executables.into_iter().find(|p| local_drive(p)
            && p.extension().is_some_and(|e| e.eq_ignore_ascii_case("exe")) && p.is_file())
            .ok_or_else(|| Failure::new("local_application_unavailable", match application {
                ProjectApplication::Explorer => "O Explorer não está disponível neste computador.",
                ProjectApplication::Vscode => "O VS Code não foi encontrado nas pastas padrão de instalação deste computador.",
            }))?;
        let mut arguments = Vec::new();
        if application == ProjectApplication::Vscode {
            arguments.push("--new-window".into());
        }
        arguments.push(folder.into_os_string());
        Ok(LaunchPlan {
            executable,
            arguments,
        })
    }
    pub(super) fn launch(plan: LaunchPlan) -> Result<()> {
        use std::os::windows::process::CommandExt;
        // Absolute .exe only, no cmd/PowerShell/PATH lookup or concatenated command.
        Command::new(plan.executable)
            .args(plan.arguments)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(0x0800_0000)
            .spawn()
            .map_err(|_| {
                Failure::new(
                    "local_launch_failed",
                    "Não foi possível iniciar o aplicativo para esta pasta.",
                )
            })?;
        Ok(())
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn rejects_relative_network_device_and_file_paths() {
            for root in [
                "relative",
                "C:relative",
                r"\\server\share",
                r"\\.\pipe\name",
            ] {
                assert!(folder(root).is_err(), "{root}");
            }
            let file = tempfile::NamedTempFile::new().unwrap();
            assert!(folder(file.path().to_str().unwrap()).is_err());
        }
        #[test]
        fn normalizes_an_existing_local_directory_without_shell_interpretation() {
            let temp = tempfile::tempdir().unwrap();
            let path = temp.path().join("project & literal (name)");
            std::fs::create_dir(&path).unwrap();
            let resolved = folder(path.to_str().unwrap()).unwrap();
            assert!(resolved.ends_with("project & literal (name)"));
            assert!(!resolved.to_string_lossy().starts_with(r"\\?\"));
        }
        #[test]
        fn launch_plan_uses_one_literal_folder_argument_and_never_batch_files() {
            let temp = tempfile::tempdir().unwrap();
            let root = temp.path().join("Project & literal (name)");
            std::fs::create_dir(&root).unwrap();
            let batch = temp.path().join("code.cmd");
            std::fs::write(&batch, "").unwrap();
            assert!(prepare_from(
                root.to_str().unwrap(),
                ProjectApplication::Vscode,
                vec![batch]
            )
            .is_err());
            let executable = temp.path().join("Code.exe");
            std::fs::write(&executable, "").unwrap();
            let plan = prepare_from(
                root.to_str().unwrap(),
                ProjectApplication::Vscode,
                vec![executable.clone()],
            )
            .unwrap();
            assert_eq!(plan.executable, executable);
            assert_eq!(
                plan.arguments,
                vec![
                    OsString::from("--new-window"),
                    folder(root.to_str().unwrap()).unwrap().into_os_string()
                ]
            );
            assert!(
                prepare_from(root.to_str().unwrap(), ProjectApplication::Explorer, vec![]).is_err()
            );
            assert_eq!(
                folder(temp.path().join("missing").to_str().unwrap())
                    .unwrap_err()
                    .code,
                "project_folder_unavailable"
            );
        }
    }
}
