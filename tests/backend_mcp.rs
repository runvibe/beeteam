#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn rpc(app: &Router, method: &str, params: Value) -> Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/mcp")
                .header("host", "127.0.0.1")
                .header("content-type", "application/json")
                .header("accept", "application/json, text/event-stream")
                .header("mcp-protocol-version", "2025-11-25")
                .body(Body::from(
                    json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}
async fn tool(app: &Router, name: &str, args: Value) -> Value {
    let response = rpc(app, "tools/call", json!({"name":name,"arguments":args})).await;
    assert!(response.get("error").is_none(), "{response}");
    response["result"].clone()
}
async fn success(app: &Router, name: &str, args: Value) -> Value {
    let result = tool(app, name, args).await;
    assert_eq!(result["isError"], false, "{result}");
    let catalog = beeteam::routes::mcp::catalog();
    let definition = catalog["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|tool| tool["name"] == name)
        .unwrap();
    if let Some(schema) = definition.get("outputSchema") {
        jsonschema::validator_for(schema)
            .unwrap()
            .validate(&result["structuredContent"])
            .unwrap_or_else(|e| panic!("{name} output schema: {e}"));
    }
    result["structuredContent"].clone()
}
#[tokio::test]
async fn sdk_tools_resources_prompts_and_atomic_compounds() {
    let app = app().await;
    let init=rpc(&app,"initialize",json!({"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1"}})).await;
    assert!(init["result"]["capabilities"].get("resources").is_some());
    assert!(init["result"]["capabilities"].get("prompts").is_some());
    let listing = rpc(&app, "tools/list", json!({})).await;
    let tools = listing["result"]["tools"].as_array().unwrap();
    assert_eq!(tools.len(), 57);
    for tool in tools {
        jsonschema::validator_for(&tool["inputSchema"])
            .unwrap_or_else(|e| panic!("{}: {e}", tool["name"]));
        if let Some(schema) = tool.get("outputSchema") {
            jsonschema::validator_for(schema).unwrap();
        }
    }
    let resources = rpc(&app, "resources/list", json!({})).await;
    for resource in resources["result"]["resources"].as_array().unwrap() {
        let read = rpc(&app, "resources/read", json!({"uri":resource["uri"]})).await;
        assert!(
            read["result"]["contents"][0]["text"]
                .as_str()
                .unwrap()
                .len()
                > 100
        );
    }
    assert!(rpc(
        &app,
        "resources/read",
        json!({"uri":"file:///C:/Users/phili/.ssh/id_rsa"})
    )
    .await
    .get("error")
    .is_some());
    let agent=success(&app,"createAgent",json!({"body":{"name":"MCP agent"},"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4()})).await["data"].clone();
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"MCP team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"MCP board","teamId":id(&team)}),
        None,
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"MCP task","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    let child=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Child","parentId":id(&task),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),ver(&task)).await;
    let task = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    let prepared = success(&app, "prepare_execution", json!({"taskId":id(&task)})).await;
    assert_eq!(prepared["task"]["version"], task["version"]);
    assert_eq!(prepared["executionContext"]["effectiveMode"], "manual");
    assert_eq!(prepared["children"]["total"], 1);
    let failed=tool(&app,"record_progress",json!({"taskId":id(&task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must rollback","subtaskUpdates":[{"taskId":id(&child),"expectedVersion":999,"progress":{"percent":50,"note":"Half"}}]})).await;
    assert_eq!(failed["isError"], true);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(&task))).await["total"],
        0
    );
    let input = json!({"taskId":id(&task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Progress","progress":{"percent":20,"note":"Started"},"subtaskUpdates":[{"taskId":id(&child),"expectedVersion":child["version"],"progress":{"percent":50,"note":"Half"}}]});
    let result = success(&app, "record_progress", input.clone()).await;
    assert_eq!(result["task"]["progress"]["percent"], 20);
    assert_eq!(success(&app, "record_progress", input).await, result);
    let task = &result["task"];
    let failed=tool(&app,"close_activity",json!({"taskId":id(task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must rollback too","execution":{"summary":"Wrong context","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&child),"originBoardId":id(&board)}}})).await;
    assert_eq!(failed["isError"], true);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(task))).await["total"],
        1
    );
    let result=success(&app,"close_activity",json!({"taskId":id(task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"execution":{"summary":"Partial work","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":["Next step"],"executionContext":{"rootTaskId":id(task),"originBoardId":id(&board)}}})).await;
    assert_eq!(result["task"]["statusId"], task["statusId"]);
    let summaries = get(
        &app,
        &format!("/api/v1/tasks/{}/execution-summaries", id(task)),
    )
    .await;
    assert_eq!(summaries["total"], 1);
    let malformed=tool(&app,"createAttachment",json!({"params":{"taskId":id(task)},"body":{"description":42},"actor":{"kind":"human"},"expectedVersion":result["task"]["version"],"idempotencyKey":uuid::Uuid::new_v4(),"upload":{"name":"file.txt","mediaType":"text/plain","dataBase64":"YQ=="}})).await;
    assert_eq!(
        malformed["isError"], true,
        "MCP must enforce the same multipart metadata schema as HTTP"
    );
    let prompts = rpc(&app, "prompts/list", json!({})).await;
    assert_eq!(prompts["result"]["prompts"].as_array().unwrap().len(), 3);
    for (name, args) in [
        ("task_briefing", json!({"taskId":id(task)})),
        (
            "agent_resumption",
            json!({"taskId":id(task),"agentId":id(&agent)}),
        ),
        ("delivery_review", json!({"taskId":id(task)})),
    ] {
        let prompt = rpc(&app, "prompts/get", json!({"name":name,"arguments":args})).await;
        assert!(prompt.get("error").is_none(), "{prompt}");
        let text = prompt["result"]["messages"][0]["content"]["text"]
            .as_str()
            .unwrap();
        assert!(text.contains("originBoardId"));
        assert!(!text.contains("{{taskId}}"));
    }
}
