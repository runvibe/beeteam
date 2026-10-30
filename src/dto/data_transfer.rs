use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Entry {
    pub bytes: u64,
    pub sha256: String,
    pub rows: Option<u64>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    pub format_version: u32,
    pub archive_id: Uuid,
    pub application_version: String,
    pub source_driver: String,
    pub snapshot_at: String,
    pub sequence_floor: i64,
    pub entries: BTreeMap<String, Entry>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TimestampPolicy {
    #[default]
    Strict,
    TruncateToMicroseconds,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestoreRequest {
    pub confirmation_token: Uuid,
    pub archive_sha256: String,
    pub destination_id: Uuid,
    #[serde(default)]
    pub timestamp_policy: TimestampPolicy,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub manifest: Manifest,
    pub archive_sha256: String,
    pub destination_id: Uuid,
    pub destination_driver: String,
    pub destination_empty: bool,
    pub precision_changes: u64,
    pub confirmation_token: Uuid,
    pub expires_at: String,
    pub warnings: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: Uuid,
    pub kind: String,
    pub state: String,
    pub stage: String,
    pub bytes: u64,
    pub records: u64,
    pub created_at: String,
    pub updated_at: String,
    pub error: Option<String>,
    pub archive_sha256: Option<String>,
    pub preview: Option<Preview>,
    pub result: Option<serde_json::Value>,
    pub cancel_requested: bool,
}
