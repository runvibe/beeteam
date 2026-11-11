use crate::{
    dto::{
        backend::{Failure, Result},
        contracts::validate_schema,
    },
    services::managed_agents::command,
    state::AppState,
};
use serde_json::{json, Value};
pub fn tools() -> Vec<Value> {
    let v: Value =
        serde_json::from_str(include_str!("../../docs/proposals/managed-agents-mcp.json")).unwrap();
    v["tools"].as_array().unwrap().iter().map(|t|{let mut t=t.clone();t.as_object_mut().unwrap().remove("x-http-operation");t["description"]=json!("Send requests to Bee Team-owned agents or inspect/configure their execution. Never accepts an external provider session ID. Requests may execute code locally; actors are metadata, not authentication.");t}).collect()
}
pub async fn call(state: &AppState, name: &str, args: Value) -> Result<Value> {
    if !state.leader_chat().is_configured() {
        return Err(Failure::new(
            "local_action_forbidden",
            "Managed MCP requires the protected local runtime",
        ));
    }
    let tool = tools()
        .into_iter()
        .find(|t| t["name"] == name)
        .ok_or_else(Failure::missing)?;
    validate_schema(&json!({}), &tool["inputSchema"], &args)?;
    let op = match name {
        "getAgentExecutionConfiguration" => "config",
        "configureAgentExecution" => "configure",
        "sendAgentRequest" => "send",
        "listAgentRequests" => "requests",
        "listAgentConversations" => "conversations",
        "getAgentConversation" => "conversation",
        "listTeamManagedApprovals" => "team-approvals",
        "getAgentRequest" => "snapshot",
        "listAgentConversationMessages" => "messages",
        "cancelAgentRequest" => "cancel",
        "reconcileAgentRequest" => "reconcile",
        "decideAgentRequestApproval" => "decision",
        "listAgentSessions" => "sessions",
        "updateAgentConversation" => "update-conversation",
        _ => return Err(Failure::missing()),
    };
    let mut c = command(op);
    if let Some(p) = args["params"].as_object() {
        for (k, v) in p {
            c.params.insert(
                k.clone(),
                crate::dto::backend::parse_id(v.as_str().unwrap())?.to_string(),
            );
        }
    }
    if let Some(q) = args["query"].as_object() {
        c.query = q.clone().into_iter().collect();
    }
    c.body = args.get("body").cloned().unwrap_or(Value::Null);
    c.expected_version = args["expectedVersion"].as_i64();
    c.idempotency_key = args["idempotencyKey"]
        .as_str()
        .map(uuid::Uuid::parse_str)
        .transpose()
        .map_err(|_| Failure::invalid("Invalid key"))?;
    if op == "sessions" {
        let query = c
            .query
            .iter()
            .map(|(k, v)| (k.clone(), v.as_str().map_or_else(|| v.to_string(), str::to_owned)))
            .collect();
        return Ok(json!({"data":state.managed_agents().sessions(&query).await?}));
    }
    let data = if op == "reconcile" {
        state.managed_agents().reconcile(c).await?
    } else if matches!(
        op,
        "send" | "configure" | "cancel" | "decision" | "update-conversation"
    ) {
        state.managed_agents().write(c, "mcp").await?
    } else {
        state.managed_agents().read(c).await?
    };
    Ok(json!({"data":data}))
}
