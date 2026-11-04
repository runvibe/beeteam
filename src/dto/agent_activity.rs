//! Latest attributed task event, independent of task ownership and profile updates.
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AgentActivity {
    #[serde(rename = "type")]
    pub event_type: String,
    pub occurred_at: String,
    pub task_id: Uuid,
    pub task_slug: String,
    pub task_title: String,
    pub event_id: Uuid,
    pub summary_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct AgentLatestActivity {
    pub activity: Option<AgentActivity>,
}
