//! MCP adaptation only; the integrated service owns lifecycle and observation.
use crate::{
    dto::backend::{Actor, Failure, Result},
    services::leader_chat::command,
    state::AppState,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Arguments {
    params: Params,
    body: Option<Value>,
    actor: Option<Actor>,
    expected_version: Option<i64>,
    idempotency_key: Option<Uuid>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Params {
    agent_id: String,
}
pub async fn call(state: &AppState, name: &str, args: Value) -> Result<Value> {
    let args: Arguments =
        serde_json::from_value(args).map_err(|e| Failure::invalid(e.to_string()))?;
    if name == "getAgentRuntime"
        && (args.body.is_some()
            || args.actor.is_some()
            || args.expected_version.is_some()
            || args.idempotency_key.is_some())
    {
        return Err(Failure::invalid("Runtime observation only accepts params"));
    }
    crate::dto::backend::parse_id(&args.params.agent_id)?;
    let mut c = command(if name == "createIntegratedSession" {
        "create-session"
    } else {
        "runtime"
    });
    c.params.insert("agentId".into(), args.params.agent_id);
    c.actor = args.actor;
    c.expected_version = args.expected_version;
    c.idempotency_key = args.idempotency_key;
    c.body = args.body.unwrap_or(Value::Null);
    let data = match name {
        "createIntegratedSession" => state.leader_chat().create_session(c).await?,
        "getAgentRuntime" => state.leader_chat().read(c).await?,
        _ => return Err(Failure::missing()),
    };
    Ok(
        json!({"createdId":if name=="createIntegratedSession"{data["bindingId"].clone()}else{Value::Null},"version":null,"data":data}),
    )
}
