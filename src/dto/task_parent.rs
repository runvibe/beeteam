//! Validated input for linking an existing task; shared by HTTP and MCP.
use super::backend::{Failure, Result};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LinkTaskToParent {
    pub parent_id: Uuid,
    pub parent_version: i64,
    pub previous_parent_version: Option<i64>,
    pub coordination_context: Value,
}
impl LinkTaskToParent {
    pub fn parse(body: &Value) -> Result<Self> {
        serde_json::from_value(body.clone()).map_err(|e| Failure::invalid(e.to_string()))
    }
}
