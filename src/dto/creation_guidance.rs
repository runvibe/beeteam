//! Shared, read-only creation guidance contracts.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CreationEntity {
    Team,
    Agent,
    Board,
    Task,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreationGuidanceRequest {
    pub entity: CreationEntity,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreationGuidance {
    pub entity: CreationEntity,
    pub operation_id: String,
    pub method: String,
    pub path: String,
    pub parameters: Vec<Value>,
    pub body_schema: Value,
    pub required_fields: Vec<String>,
    pub rules: Vec<String>,
}

pub fn tool() -> Value {
    json!({"name":"get_creation_guidance","description":"Internal read-only guidance for creating a team, agent, board or task. Returns current creation contracts and workflow rules; creates no resources or sessions.",
        "annotations":{"readOnlyHint":true,"destructiveHint":false,"idempotentHint":true,"openWorldHint":false},
        "inputSchema":{"type":"object","properties":{"entity":{"type":"string","enum":["team","agent","board","task"]}},"required":["entity"],"additionalProperties":false},
        "outputSchema":{"type":"object","properties":{
            "entity":{"type":"string","enum":["team","agent","board","task"]},
            "operationId":{"type":"string"},"method":{"type":"string"},"path":{"type":"string"},
            "parameters":{"type":"array","items":{"type":"object"}},"bodySchema":{"type":"object"},
            "requiredFields":{"type":"array","items":{"type":"string"}},"rules":{"type":"array","items":{"type":"string"}}
        },"required":["entity","operationId","method","path","parameters","bodySchema","requiredFields","rules"],"additionalProperties":false}})
}
