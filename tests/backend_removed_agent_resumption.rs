#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn rpc(app: &Router, method: &str, params: Value) -> Value {
    let response = app.clone().oneshot(Request::post("/mcp")
        .header("host", "127.0.0.1")
        .header("content-type", "application/json")
        .header("accept", "application/json, text/event-stream")
        .header("mcp-protocol-version", "2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap()
}

#[tokio::test]
async fn removed_aggregate_does_not_remove_profile_team_or_conversation_data() {
    let app = app().await;
    let agent = ok(&app,"POST","/api/v1/agents",json!({"name":"Preserved agent","workInstructions":"Keep these instructions","contextSummary":"Keep this context"}),None).await;
    let team = ok(&app,"POST","/api/v1/teams",json!({"name":"Preserved team","leaderId":id(&agent),"purpose":"Keep purpose","context":"Keep team context","coordinationContext":manual()}),None).await;
    let profile_path = format!("/api/v1/agents/{}",id(&agent));
    let live = get(&app,&profile_path).await;
    let chat = ok(&app,"POST",&format!("{profile_path}/chat-references"),json!({"harness":"codex","externalId":"preserved-reference","label":"Keep conversation"}),ver(&live)).await;
    let before = get(&app,&profile_path).await;
    assert_eq!(request(&app,"GET",&format!("{profile_path}/resumption-context"),Value::Null,None).await.0,404);
    let removed = rpc(&app,"tools/call",json!({"name":"getResumptionContext","arguments":{"params":{"agentId":id(&agent)}}})).await;
    assert_eq!(removed["result"]["isError"],true);
    assert!(rpc(&app,"prompts/get",json!({"name":"agent_resumption","arguments":{"agentId":id(&agent),"taskId":uuid::Uuid::now_v7().to_string()}})).await.get("error").is_some());
    assert_eq!(get(&app,&profile_path).await,before);
    assert_eq!(before["workInstructions"],"Keep these instructions");
    assert_eq!(before["contextSummary"],"Keep this context");
    assert_eq!(get(&app,&format!("/api/v1/teams/{}",id(&team))).await["context"],"Keep team context");
    assert_eq!(get(&app,&format!("{profile_path}/chat-references")).await["items"][0]["id"],chat["id"]);
    let catalog = beeteam::routes::mcp::catalog();
    let tools = catalog["tools"].as_array().unwrap();
    assert!(!tools.iter().any(|t|t["name"]=="getResumptionContext"));
    for name in ["getAgent","getTeam","listChatReferences","listAgentActivities","prepare_execution","listOpenExecutionIntervals","close_activity"] {
        assert!(tools.iter().any(|t|t["name"]==name),"{name}");
    }
    let prompts = catalog["prompts"].as_array().unwrap();
    assert_eq!(prompts.len(),2);
    assert!(!prompts.iter().any(|p|p["name"]=="agent_resumption"));
}
