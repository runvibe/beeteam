//! Driver-independent results of local checkout inspection; no transport or process IO.
use serde::Serialize;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInspection {
    pub status: &'static str,
    pub reason: Option<&'static str>,
    pub checked_at: String,
    pub checkout_root: Option<String>,
    pub git_directory: Option<String>,
    pub common_directory: Option<String>,
    pub is_worktree: Option<bool>,
    pub branch: Option<GitBranch>,
    pub head_hash: Option<String>,
    pub repository_key: Option<String>,
    pub remotes: Vec<GitRemote>,
}
#[derive(Clone, Debug, Serialize)]
pub struct GitBranch {
    pub state: &'static str,
    pub name: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
pub struct GitRemote {
    pub name: String,
    pub url: Option<String>,
}
impl GitInspection {
    pub fn unavailable(reason: &'static str) -> Self {
        Self {
            status: "unavailable",
            reason: Some(reason),
            checked_at: chrono::Utc::now().to_rfc3339(),
            checkout_root: None,
            git_directory: None,
            common_directory: None,
            is_worktree: None,
            branch: None,
            head_hash: None,
            repository_key: None,
            remotes: vec![],
        }
    }
}
