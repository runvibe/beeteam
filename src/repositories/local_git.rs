//! Bounded, read-only Git subprocess adapter. Never fetches, runs hooks or enumerates worktrees.
use super::contracts::{GitBranch, GitInspection, GitRemote, ProjectDiscovery};
use std::{
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};
use tokio::{
    io::AsyncReadExt,
    process::Command,
    time::{timeout, timeout_at, Instant},
};
use url::Url;

pub struct LocalGitDiscovery {
    command_timeout: Duration,
    batch_timeout: Duration,
    output_limit: usize,
}
impl Default for LocalGitDiscovery {
    fn default() -> Self {
        Self {
            command_timeout: Duration::from_secs(3),
            batch_timeout: Duration::from_secs(15),
            output_limit: 65536,
        }
    }
}
struct GitOutput {
    success: bool,
    code: Option<i32>,
    stdout: String,
    stderr: String,
}
type InspectionResult<T> = std::result::Result<T, &'static str>;
impl LocalGitDiscovery {
    async fn command(&self, root: &Path, args: &[&str]) -> InspectionResult<GitOutput> {
        let mut command = Command::new("git");
        command.env_clear();
        for key in ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"] {
            if let Some(value) = std::env::var_os(key) {
                command.env(key, value);
            }
        }
        let null = if cfg!(windows) { "NUL" } else { "/dev/null" };
        command
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_CONFIG_GLOBAL", null)
            .env("GIT_CONFIG_SYSTEM", null)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GIT_PAGER", "")
            .env("LC_ALL", "C")
            .args([
                "--no-pager",
                "--no-optional-locks",
                "-c",
                "core.fsmonitor=false",
                "-c",
                "core.hooksPath=/dev/null",
                "-C",
            ])
            .arg(root)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        let mut child = command.spawn().map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "git_unavailable"
            } else {
                "inspection_failed"
            }
        })?;
        let stdout = child.stdout.take().ok_or("inspection_failed")?;
        let stderr = child.stderr.take().ok_or("inspection_failed")?;
        let read = async {
            let (out, err, status) = tokio::try_join!(
                bounded(stdout, self.output_limit),
                bounded(stderr, self.output_limit),
                async { child.wait().await.map_err(|_| "inspection_failed") }
            )?;
            Ok(GitOutput {
                success: status.success(),
                code: status.code(),
                stdout: String::from_utf8(out).map_err(|_| "inspection_failed")?,
                stderr: String::from_utf8(err).map_err(|_| "inspection_failed")?,
            })
        };
        match timeout(self.command_timeout, read).await {
            Ok(Ok(output)) => Ok(output),
            Ok(Err(reason)) => {
                let _ = child.kill().await;
                Err(reason)
            }
            Err(_) => {
                let _ = child.kill().await;
                Err("timeout")
            }
        }
    }
    async fn inspect(&self, root: &str) -> InspectionResult<GitInspection> {
        let metadata = tokio::fs::metadata(root)
            .await
            .map_err(|_| "path_unavailable")?;
        if !metadata.is_dir() {
            return Err("path_unavailable");
        }
        let output = self
            .command(
                Path::new(root),
                &[
                    "rev-parse",
                    "--path-format=absolute",
                    "--show-toplevel",
                    "--absolute-git-dir",
                    "--git-common-dir",
                    "--is-inside-work-tree",
                ],
            )
            .await?;
        let mut result = GitInspection::unavailable("inspection_failed");
        if !output.success {
            if output.stderr.contains("not a git repository") {
                result.status = "not_git";
                result.reason = None;
                return Ok(result);
            }
            return Err("inspection_failed");
        }
        let paths: Vec<_> = output.stdout.lines().collect();
        if paths.len() != 4 || paths[3] != "true" {
            return Err("inspection_failed");
        }
        let checkout = canonical(paths[0]).await?;
        let git_dir = canonical(paths[1]).await?;
        let common = canonical(paths[2]).await?;
        let branch = self
            .command(
                Path::new(root),
                &["symbolic-ref", "--quiet", "--short", "HEAD"],
            )
            .await?;
        let head = self
            .command(Path::new(root), &["rev-parse", "--verify", "HEAD"])
            .await?;
        let hash = head.stdout.trim();
        if head.success
            && !((hash.len() == 40 || hash.len() == 64)
                && hash.bytes().all(|b| b.is_ascii_hexdigit()))
        {
            return Err("inspection_failed");
        }
        let branch_name = branch.stdout.trim();
        result.branch = Some(
            if branch.success
                && !branch_name.is_empty()
                && !branch_name.chars().any(char::is_control)
            {
                GitBranch {
                    state: "named",
                    name: Some(branch_name.to_owned()),
                }
            } else if branch.code == Some(1) && head.success {
                GitBranch {
                    state: "detached",
                    name: None,
                }
            } else {
                GitBranch {
                    state: "unknown",
                    name: None,
                }
            },
        );
        result.head_hash = head.success.then(|| hash.to_ascii_lowercase());
        let config = self
            .command(
                Path::new(root),
                &[
                    "config",
                    "--local",
                    "--no-includes",
                    "--null",
                    "--get-regexp",
                    r"^remote\..*\.url$",
                ],
            )
            .await?;
        if !config.success && config.code != Some(1) {
            return Err("inspection_failed");
        }
        for entry in config.stdout.split('\0').filter(|s| !s.is_empty()) {
            let (key, value) = entry.split_once('\n').ok_or("inspection_failed")?;
            let name = key
                .strip_prefix("remote.")
                .and_then(|k| k.strip_suffix(".url"))
                .ok_or("inspection_failed")?;
            if name.is_empty() || name.len() > 200 || name.chars().any(char::is_control) {
                return Err("inspection_failed");
            }
            result.remotes.push(GitRemote {
                name: name.to_owned(),
                url: sanitize_remote(value),
            });
            if result.remotes.len() > 100 {
                return Err("output_limit");
            }
        }
        result.remotes.sort_by(|a, b| a.name.cmp(&b.name));
        result.status = "detected";
        result.reason = None;
        result.is_worktree = Some(git_dir != common);
        result.checkout_root = Some(checkout);
        result.git_directory = Some(git_dir);
        result.common_directory = Some(common);
        Ok(result)
    }
}
impl ProjectDiscovery for LocalGitDiscovery {
    fn discover<'a>(
        &'a self,
        roots: &'a [String],
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Vec<GitInspection>> + Send + 'a>> {
        Box::pin(async move {
            let deadline = Instant::now() + self.batch_timeout;
            let mut results = Vec::with_capacity(roots.len());
            for root in roots {
                if Instant::now() >= deadline {
                    results.push(GitInspection::unavailable("timeout"));
                    continue;
                }
                results.push(match timeout_at(deadline, self.inspect(root)).await {
                    Ok(Ok(value)) => value,
                    Ok(Err(reason)) => GitInspection::unavailable(reason),
                    Err(_) => GitInspection::unavailable("timeout"),
                });
            }
            results
        })
    }
}
async fn bounded(
    reader: impl tokio::io::AsyncRead + Unpin,
    limit: usize,
) -> InspectionResult<Vec<u8>> {
    let mut output = Vec::new();
    reader
        .take(limit as u64 + 1)
        .read_to_end(&mut output)
        .await
        .map_err(|_| "inspection_failed")?;
    if output.len() > limit {
        return Err("output_limit");
    }
    Ok(output)
}
async fn canonical(path: &str) -> InspectionResult<String> {
    let path = tokio::fs::canonicalize(PathBuf::from(path))
        .await
        .map_err(|_| "inspection_failed")?;
    let value = path.to_str().ok_or("inspection_failed")?;
    if value.chars().any(char::is_control) {
        return Err("inspection_failed");
    }
    // Keep ordinary Windows absolute paths useful to clients, including UNC roots.
    Ok(if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{unc}")
    } else {
        value.strip_prefix(r"\\?\").unwrap_or(value).to_owned()
    })
}
/// Credentials and executable transports are never retained in task history.
pub fn sanitize_remote(raw: &str) -> Option<String> {
    if raw.len() > 2048
        || raw.chars().any(char::is_whitespace)
        || raw.trim() != raw
        || raw.contains("::")
    {
        return None;
    }
    let mut url = if raw.contains("://") {
        Url::parse(raw).ok()?
    } else {
        let (host, path) = raw.split_once(':')?;
        if matches!(
            host.to_ascii_lowercase().as_str(),
            "javascript" | "data" | "file" | "ext" | "http" | "https"
        ) {
            return None;
        }
        if host.contains('/') || path.starts_with('/') || host.contains('\\') {
            return None;
        }
        let host = host.rsplit('@').next()?;
        Url::parse(&format!("ssh://{host}/{path}")).ok()?
    };
    if !matches!(url.scheme(), "http" | "https" | "ssh") || url.host_str().is_none() {
        return None;
    }
    url.set_username("").ok()?;
    url.set_password(None).ok()?;
    url.set_query(None);
    url.set_fragment(None);
    Some(url.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn remotes_drop_credentials_and_unsafe_transports() {
        assert_eq!(
            sanitize_remote("https://user:secret@github.com/org/repo.git?token=secret#x")
                .as_deref(),
            Some("https://github.com/org/repo.git")
        );
        assert_eq!(
            sanitize_remote("git@github.com:org/repo.git").as_deref(),
            Some("ssh://github.com/org/repo.git")
        );
        for value in [
            "ext::sh command",
            "file:///tmp/repo",
            "javascript:alert(1)",
            "https://host/\nrepo",
        ] {
            assert!(sanitize_remote(value).is_none(), "{value}");
        }
    }
    #[tokio::test]
    async fn bounded_output_rejects_excess() {
        assert_eq!(bounded(&b"12345"[..], 4).await.unwrap_err(), "output_limit");
    }
    #[tokio::test]
    async fn subprocess_and_batch_limits_are_observed() {
        let limited = LocalGitDiscovery {
            output_limit: 4,
            ..Default::default()
        };
        assert!(matches!(
            limited.command(Path::new("."), &["--version"]).await,
            Err("output_limit")
        ));
        let limited = LocalGitDiscovery {
            batch_timeout: Duration::ZERO,
            ..Default::default()
        };
        let found = limited
            .discover(&[std::env::temp_dir().to_string_lossy().to_string()])
            .await;
        assert_eq!(found[0].status, "unavailable");
        assert_eq!(found[0].reason, Some("timeout"));
    }
}
