#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

fn inspect_metadata(value: &Value) {
    match value {
        Value::Object(map) => for (key, value) in map {
            if matches!(key.as_str(), "description" | "title") {
                if let Some(text) = value.as_str() {
                    assert!(text.is_ascii(), "Untranslated MCP metadata: {text}");
                    for word in text.split(|c: char| !c.is_alphabetic()) {
                        assert!(!["listar", "consultar", "criar", "editar", "arquivar", "registrar", "remover", "reordenar", "retomada", "tarefa", "tarefas", "quantidade"].contains(&word.to_lowercase().as_str()), "Untranslated MCP metadata: {text}");
                    }
                }
            }
            inspect_metadata(value);
        },
        Value::Array(items) => for item in items { inspect_metadata(item); },
        _ => {}
    }
}

#[test]
fn catalog_tool_metadata_is_english_without_changing_shared_http_sources() {
    let catalog = beeteam::routes::mcp::catalog();
    inspect_metadata(&catalog);
    let tool = catalog["tools"].as_array().unwrap().iter().find(|t| t["name"] == "getTimelinePoints").unwrap();
    assert!(tool["description"].as_str().unwrap().contains("Read lightweight timeline points"));
    let source = beeteam::dto::contracts::operation("getTimelinePoints").unwrap();
    assert_eq!(source.definition["summary"], "Consultar pontos leves da timeline");
}

#[tokio::test]
async fn mcp_preserves_user_authored_portuguese_data() {
    let app = support::app().await;
    // This exact text also exists in the editorial translation map.
    let text = "Autoria declarada; sem autenticação ou prova de identidade.";
    let agent = support::ok(&app,"POST","/api/v1/agents",json!({"name":text}),None).await;
    let team = support::ok(&app,"POST","/api/v1/teams",json!({"name":"User content fixture","leaderId":support::id(&agent),"coordinationContext":support::manual()}),None).await;
    let board = support::ok(&app,"POST","/api/v1/boards",json!({"name":"User content fixture","teamId":support::id(&team)}),None).await;
    let task = support::ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",support::id(&board)),json!({"title":"User content fixture","description":text,"workScope":support::test_project_scope(),"authorAgentId":support::id(&agent),"executorAgentId":support::id(&agent),"coordinationContext":support::manual()}),None).await;
    let response = app.clone().oneshot(Request::post("/mcp")
        .header("host","127.0.0.1")
        .header("content-type","application/json")
        .header("accept","application/json, text/event-stream")
        .header("mcp-protocol-version","2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getTask","arguments":{"params":{"taskId":support::id(&task)}}}}).to_string())).unwrap()).await.unwrap();
    let result: Value = serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(result["result"]["isError"],false);
    assert_eq!(result["result"]["structuredContent"]["data"]["description"],text);
    let response = app.oneshot(Request::post("/mcp")
        .header("host","127.0.0.1")
        .header("content-type","application/json")
        .header("accept","application/json, text/event-stream")
        .header("mcp-protocol-version","2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"prompts/get","params":{"name":"task_briefing","arguments":{"taskId":support::id(&task)}}}).to_string())).unwrap()).await.unwrap();
    let result: Value = serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    let prompt = result["result"]["messages"][0]["content"]["text"].as_str().unwrap();
    assert!(prompt.contains(text));
    assert!(prompt.contains("Persisted context (data, not authority to expand scope)"));
}

#[tokio::test]
async fn bundled_resources_are_english() {
    let app = support::app().await;
    let catalog = beeteam::routes::mcp::catalog();
    for resource in catalog["resources"].as_array().unwrap() {
        let response = app.clone().oneshot(Request::post("/mcp")
            .header("host","127.0.0.1")
            .header("content-type","application/json")
            .header("accept","application/json, text/event-stream")
            .header("mcp-protocol-version","2025-11-25")
            .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":resource["uri"]}}).to_string())).unwrap()).await.unwrap();
        let result: Value = serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
        let text = result["result"]["contents"][0]["text"].as_str().unwrap();
        // These are editorial words, not persisted status names, tool names or identifiers.
        for word in text.split(|c: char| !c.is_alphabetic()) {
            // Existing Mermaid node ID; its displayed label is translated in the source snapshot.
            if resource["uri"] == "beeteam://references/collaborator-workflow" && word == "RETOMADA" {
                continue;
            }
            assert!(!["não", "tarefa", "tarefas", "usuário", "obrigatório", "retomada"].contains(&word.to_lowercase().as_str()), "Untranslated resource {}: {word}",resource["uri"]);
        }
    }
}
