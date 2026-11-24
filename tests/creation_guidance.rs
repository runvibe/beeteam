#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

async fn tool(app: &Router, arguments: Value) -> Value {
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/mcp")
        .header("host", "127.0.0.1").header("content-type", "application/json")
        .header("accept", "application/json, text/event-stream")
        .header("mcp-protocol-version", "2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_creation_guidance","arguments":arguments}}).to_string())).unwrap()).await.unwrap();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice::<Value>(&bytes).unwrap()["result"].clone()
}

#[tokio::test]
async fn creation_guidance_contract_parity_and_no_mutations() {
    let app = support::app().await;
    let definition = beeteam::dto::creation_guidance::tool();
    assert_eq!(definition["annotations"]["readOnlyHint"], true);
    let output_validator = jsonschema::validator_for(&definition["outputSchema"]).unwrap();
    let paths = [
        "/api/v2/boards",
        "/api/v2/agents",
        "/api/v2/teams",
        "/api/v2/tasks",
    ];
    let mut before = Vec::new();
    for path in paths {
        let response = support::request(&app, "GET", path, json!(null), None).await;
        assert_eq!(response.0, 200, "{path}: {response:?}");
        before.push(response);
    }
    for (entity, operation) in [
        ("team", "createTeam"),
        ("agent", "createAgent"),
        ("board", "createBoard"),
        ("task", "createTask"),
    ] {
        let (status, http) = support::request(
            &app,
            "GET",
            &format!("/api/v1/creation-guidance?entity={entity}"),
            json!(null),
            None,
        )
        .await;
        assert_eq!(status, 200, "{http}");
        let mcp = tool(&app, json!({"entity":entity})).await;
        assert_eq!(mcp["isError"], false, "{mcp}");
        assert_eq!(http, mcp["structuredContent"]);
        output_validator.validate(&http).unwrap();
        let op = beeteam::dto::contracts::operation(operation).unwrap();
        let schema = beeteam::dto::contracts::inline_schema(
            &op.document,
            &op.definition["requestBody"]["content"]["application/json"]["schema"],
        );
        assert_eq!(http["operationId"], operation);
        assert_eq!(http["bodySchema"], schema);
        assert_eq!(http["requiredFields"], schema["required"]);
        assert_eq!(http["path"], op.path);
        assert_eq!(http["method"], op.method);
        assert_eq!(
            http["parameters"],
            json!(op
                .parameters
                .iter()
                .map(|p| beeteam::dto::contracts::inline_schema(&op.document, p))
                .collect::<Vec<_>>())
        );
        if entity == "task" {
            assert!(http["parameters"]
                .as_array()
                .unwrap()
                .iter()
                .any(|p| p["in"] == "path" && p["name"] == "boardId" && p["required"] == true));
            assert!(http["bodySchema"]["properties"].get("boardId").is_none());
        }
        assert!(!http["rules"].as_array().unwrap().is_empty());
    }
    for (query, args) in [
        ("entity=workspace", json!({"entity":"workspace"})),
        (
            "entity=team&extra=true",
            json!({"entity":"team","extra":true}),
        ),
        ("", json!({})),
    ] {
        let (status, http) = support::request(
            &app,
            "GET",
            &format!("/api/v1/creation-guidance?{query}"),
            json!(null),
            None,
        )
        .await;
        assert_eq!(status, 400);
        let mcp = tool(&app, args).await;
        assert_eq!(mcp["isError"], true);
        assert_eq!(http["code"], mcp["structuredContent"]["code"]);
        assert_eq!(http["code"], "invalid_request");
    }
    for (path, expected) in paths.into_iter().zip(before) {
        assert_eq!(
            support::request(&app, "GET", path, json!(null), None).await,
            expected
        );
    }
}
