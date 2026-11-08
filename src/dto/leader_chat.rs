//! Provider-neutral integrated chat requests and validation.
use crate::dto::backend::{Failure, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateChat {
    pub team_id: Uuid,
    pub leader_agent_id: Uuid,
    pub binding_id: Uuid,
    pub title: String,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SendMessage {
    pub client_message_id: Uuid,
    pub binding_id: Uuid,
    pub content: String,
    #[serde(default)]
    pub task_id: Option<Uuid>,
}
impl SendMessage {
    pub fn validate(&self) -> Result<()> {
        if self.content.trim().is_empty() {
            return Err(Failure::invalid("Message must not be blank"));
        }
        if self.content.len() > 65536 {
            return Err(Failure::new(
                "payload_too_large",
                "Message exceeds 65536 UTF-8 bytes",
            ));
        }
        Ok(())
    }
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateSession {
    pub project_root: String,
    pub expected_binding_id: Option<Uuid>,
    #[serde(default)]
    pub tool_profile: serde_json::Value,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ApprovalDecision {
    pub decision: String,
}
pub fn terminal(state: &str) -> bool {
    matches!(state, "completed" | "cancelled" | "failed")
}
