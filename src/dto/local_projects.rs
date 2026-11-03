use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectApplication {
    Explorer,
    Vscode,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OpenProjectRequest {
    pub application: ProjectApplication,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectResponse {
    pub project_key: String,
    pub application: ProjectApplication,
    /// A process was started, not proof that a GUI window was displayed.
    pub outcome: &'static str,
}
