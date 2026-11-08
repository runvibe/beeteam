//! Stateless MCP JSON transport. Tools adapt the same Commands used by HTTP.
use std::collections::BTreeMap;

use crate::{
    dto::{
        backend::*,
        contracts::{self, OPERATIONS},
    },
    services,
    state::AppState,
};
use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Arguments {
    #[serde(default)]
    params: BTreeMap<String, String>,
    #[serde(default)]
    query: BTreeMap<String, Value>,
    #[serde(default = "empty")]
    body: Value,
    actor: Option<Actor>,
    expected_version: Option<i64>,
    idempotency_key: Option<Uuid>,
    upload: Option<FileInput>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct FileInput {
    name: String,
    media_type: String,
    data_base64: String,
}
fn empty() -> Value {
    json!({})
}
pub(super) fn tools() -> Vec<Value> {
    let mut tools = vec![
        json!({"name":"health_check","description":"Service health","inputSchema":{"type":"object","properties":{},"additionalProperties":false}}),
        json!({"name":"echo_request","description":"Echo a request","inputSchema":{"type":"object","properties":{"method":{"type":"string"},"path":{"type":"string"},"headers":{"type":"object"},"body":{"type":["string","null"]}},"required":["method","path","headers"]}}),
    ];
    for op in OPERATIONS.iter() {
        let mut paths = serde_json::Map::new();
        let mut required = Vec::new();
        let mut query = serde_json::Map::new();
        for p in &op.parameters {
            let p = contracts::resolve(&op.document, p);
            if let Some(name) = p["name"].as_str() {
                if p["in"] == "path" {
                    paths.insert(
                        name.into(),
                        contracts::inline_schema(&op.document, &p["schema"]),
                    );
                    required.push(name.to_owned());
                } else if p["in"] == "query" {
                    query.insert(
                        name.into(),
                        contracts::inline_schema(&op.document, &p["schema"]),
                    );
                }
            }
        }
        let body=op.definition.pointer("/requestBody/content/application~1json/schema").map(|s|contracts::inline_schema(&op.document,s)).unwrap_or(json!({"type":"object","properties":{"description":{"type":"string"}},"additionalProperties":false}));
        let mut needed = Vec::new();
        if !required.is_empty() {
            needed.push("params")
        }
        if op.method != "GET" {
            needed.push("actor")
        }
        if op.method == "POST" {
            needed.push("idempotencyKey")
        }
        if op
            .definition
            .pointer("/requestBody/content/application~1json/schema")
            .is_some()
        {
            needed.push("body")
        }
        let output = if op.name.starts_with("download") {
            json!({"type":"object","properties":{"contentPath":{"type":"string"},"notice":{"type":"string"}},"required":["contentPath","notice"],"additionalProperties":false})
        } else {
            let data = op
                .definition
                .pointer(&format!(
                    "/responses/{}/content/application~1json/schema",
                    op.status
                ))
                .map(|s| contracts::inline_schema(&op.document, s))
                .unwrap_or(json!({}));
            json!({"type":"object","properties":{"data":data,"version":{"type":["integer","null"]},"createdId":{"type":["string","null"],"format":"uuid"}},"required":["data","version","createdId"],"additionalProperties":false})
        };
        tools.push(json!({"name":op.name,"description":format!("{} {}. {}. Actor is declared, not authenticated.",op.method,op.path,if op.name == "createExecutionSummary" { op.definition["description"].as_str().unwrap_or("") } else { op.definition["summary"].as_str().unwrap_or("") }),"annotations":{"readOnlyHint":op.method=="GET","destructiveHint":false,"idempotentHint":op.method=="GET"||op.method=="POST","openWorldHint":false},"outputSchema":output,"inputSchema":{"type":"object","additionalProperties":false,"properties":{
            "params":{"type":"object","properties":paths,"required":required,"additionalProperties":false},
            "query":{"type":"object","properties":query,"additionalProperties":false},"body":body,
            "actor":{"type":"object","properties":{"kind":{"enum":["human","agent"]},"id":{"type":["string","null"],"format":"uuid"}},"required":["kind"],"additionalProperties":false},
            "expectedVersion":{"type":"integer","minimum":1},"idempotencyKey":{"type":"string","format":"uuid"},
            "upload":{"type":"object","properties":{"name":{"type":"string"},"mediaType":{"type":"string"},"dataBase64":{"type":"string"}},"required":["name","mediaType","dataBase64"],"additionalProperties":false}
        },"required":needed}}));
    }
    tools.extend(crate::dto::mcp::composite_tools());
    tools.extend(crate::dto::data_transfer_tools::tools());
    tools.extend(crate::dto::integrated_chat_tools::tools());
    for tool in &mut tools {
        crate::dto::mcp_language::translate_metadata(tool);
    }
    tools
}
pub(super) async fn call(state: &AppState, name: &str, arguments: Value) -> Result<Value> {
    if crate::dto::integrated_chat_tools::NAMES.contains(&name) {
        return super::integrated_chat_mcp::call(state, name, arguments).await;
    }
    if crate::dto::data_transfer_tools::NAMES.contains(&name) {
        return super::data_transfer_mcp::call(state, name, arguments).await;
    }
    if crate::dto::mcp::is_composite(name) {
        return state.backend().execute_compound(name, arguments).await;
    }
    if name == "health_check" {
        return Ok(json!(services::health::health_status()));
    }
    if name == "echo_request" {
        let input = serde_json::from_value(arguments)
            .map_err(|_| Failure::invalid("Invalid echo arguments"))?;
        return Ok(json!(services::echo::echo(input)));
    }
    let op = contracts::operation(name)?;
    let args: Arguments =
        serde_json::from_value(arguments).map_err(|e| Failure::invalid(e.to_string()))?;
    for parameter in op
        .parameters
        .iter()
        .map(|p| contracts::resolve(&op.document, p))
        .filter(|p| p["in"] == "path")
    {
        let name = parameter["name"].as_str().unwrap();
        if !args.params.contains_key(name) {
            return Err(Failure::invalid("Missing path parameter"));
        }
    }
    for key in args.params.keys() {
        if !op.path.contains(&format!("{{{key}}}")) {
            return Err(Failure::invalid("Unknown path parameter"));
        }
    }
    let query = contracts::query(
        op,
        args.query
            .into_iter()
            .map(|(k, v)| {
                (
                    k,
                    v.as_str().map(str::to_owned).unwrap_or_else(|| {
                        if let Some(items) = v.as_array() {
                            items
                                .iter()
                                .map(|v| v.as_str().unwrap_or(""))
                                .collect::<Vec<_>>()
                                .join(",")
                        } else {
                            v.to_string()
                        }
                    }),
                )
            })
            .collect(),
    )?;
    let upload = args
        .upload
        .map(|u| {
            if u.data_base64.len() > 28 * 1024 * 1024 {
                return Err(Failure::new("payload_too_large", "File too large"));
            }
            Ok(Upload {
                name: u.name,
                media_type: u.media_type,
                bytes: base64::engine::general_purpose::STANDARD
                    .decode(u.data_base64)
                    .map_err(|_| Failure::invalid("Invalid base64"))?,
            })
        })
        .transpose()?;
    let result = state
        .backend()
        .execute(Command {
            operation: name.into(),
            params: args.params.clone(),
            query,
            body: args.body,
            actor: args.actor,
            expected_version: args.expected_version,
            idempotency_key: args.idempotency_key,
            upload,
        })
        .await?;
    if result.file.is_some() {
        let mut path = op.path.clone();
        for (k, v) in args.params {
            path = path.replace(&format!("{{{k}}}"), &v);
        }
        return Ok(json!({"contentPath":path,"notice":"Download binary content through HTTP."}));
    }
    Ok(json!({"data":result.data,"version":result.version,"createdId":result.created_id}))
}
