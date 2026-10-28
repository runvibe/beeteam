use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, Failure>;
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[error("{error}")]
pub struct Failure {
    pub code: String,
    pub error: String,
    pub details: Value,
}
impl Failure {
    pub fn new(code: &str, error: impl Into<String>) -> Self {
        let canonical = match code {
            "unsupported_media" => "unsupported_media_type",
            "hierarchy_cycle" => "parent_cycle",
            "invalid_status_set" | "outcome_conflict" | "task_not_blocked" => "invalid_request",
            "duplicate_reference" | "constraint_conflict" => "usage_policy_conflict",
            other => other,
        };
        Self {
            code: canonical.into(),
            error: error.into(),
            details: if canonical == code {
                json!({})
            } else {
                json!({"reason":code})
            },
        }
    }
    pub fn invalid(error: impl Into<String>) -> Self {
        Self::new("invalid_request", error)
    }
    pub fn missing() -> Self {
        Self::new("not_found", "Resource not found")
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Actor {
    pub kind: String,
    pub id: Option<Uuid>,
}
impl Actor {
    pub fn validate(&self) -> Result<()> {
        if (self.kind == "human" && self.id.is_none())
            || (self.kind == "agent" && self.id.is_some_and(|id| id.get_version_num() == 7))
        {
            Ok(())
        } else {
            Err(Failure::new(
                "invalid_actor_context",
                "Declare human without ID, or agent with a UUIDv7 ID",
            ))
        }
    }
    pub fn value(&self) -> Value {
        json!({"actorKind":self.kind,"actorId":self.id})
    }
    pub fn key(&self) -> String {
        format!(
            "{}:{}",
            self.kind,
            self.id.map(|v| v.to_string()).unwrap_or_default()
        )
    }
}
#[derive(Debug, Clone)]
pub struct Upload {
    pub name: String,
    pub media_type: String,
    pub bytes: Vec<u8>,
}
#[derive(Debug, Clone)]
pub struct Command {
    pub operation: String,
    pub params: BTreeMap<String, String>,
    pub query: BTreeMap<String, Value>,
    pub body: Value,
    pub actor: Option<Actor>,
    pub expected_version: Option<i64>,
    pub idempotency_key: Option<Uuid>,
    pub upload: Option<Upload>,
}
impl Command {
    pub fn id(&self, key: &str) -> Result<Uuid> {
        parse_id(self.params.get(key).ok_or_else(Failure::missing)?)
    }
    pub fn actor(&self) -> Result<&Actor> {
        self.actor
            .as_ref()
            .ok_or_else(|| Failure::new("invalid_actor_context", "Actor context required"))
    }
    pub fn q(&self, key: &str) -> Value {
        self.query.get(key).cloned().unwrap_or(Value::Null)
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Outcome {
    pub data: Value,
    pub version: Option<i64>,
    pub created_id: Option<Uuid>,
    #[serde(skip)]
    pub file: Option<UploadOutput>,
}
#[derive(Debug, Clone)]
pub struct UploadOutput {
    pub name: String,
    pub media_type: String,
    pub bytes: Vec<u8>,
}
impl Outcome {
    pub fn data(data: Value) -> Self {
        let version = data["version"].as_i64();
        Self {
            data,
            version,
            created_id: None,
            file: None,
        }
    }
}
pub fn parse_id(s: &str) -> Result<Uuid> {
    let id = Uuid::parse_str(s).map_err(|_| Failure::invalid("Invalid UUID"))?;
    if id.get_version_num() != 7 || id.get_variant() != uuid::Variant::RFC4122 {
        return Err(Failure::invalid("Record IDs must be UUIDv7"));
    }
    Ok(id)
}
pub fn value_id(v: &Value) -> Result<Uuid> {
    parse_id(
        v.as_str()
            .ok_or_else(|| Failure::invalid("Expected UUIDv7"))?,
    )
}
