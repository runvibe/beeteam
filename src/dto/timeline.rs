//! Lightweight timeline output, deliberately independent of complete event payloads.
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelinePoint {
    pub id: Uuid,
    pub task_id: Uuid,
    #[serde(rename = "type")]
    pub event_type: String,
    pub occurred_at: String,
    pub sequence: i64,
}
