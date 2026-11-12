use super::*;

#[tokio::test]
async fn generated_files_are_persisted_and_downloaded_without_exposing_local_paths() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"create-file"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(sent.0, 202, "{sent:?}");
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    let message = &snapshot["messages"]["items"][1];
    let files = message["files"].as_array().expect("message files");
    assert_eq!(files.len(), 1);
    assert_eq!(files[0]["name"], "example.pdf");
    assert_eq!(files[0]["mediaType"], "application/pdf");
    assert_eq!(files[0]["sizeBytes"], TEST_PDF.len());
    assert_eq!(files[0]["status"], "available");
    assert!(!message.to_string().contains("beeteam-test-workspaces"));
    let spec: Value = serde_json::from_str(include_str!(
        "../../docs/proposals/managed-agents-openapi.json"
    ))
    .unwrap();
    beeteam::dto::contracts::validate_schema(
        &spec,
        &spec["components"]["schemas"]["RequestSnapshot"],
        &snapshot,
    )
    .unwrap();
    let conversation = sent.1["conversationId"].as_str().unwrap();
    let path = format!(
        "/api/v2/agent-conversations/{conversation}/messages/{}/files/{}",
        id(message),
        id(&files[0])
    );
    std::fs::remove_file(
        std::env::temp_dir()
            .join("beeteam-test-workspaces")
            .join(id(&agent))
            .join("output/example.pdf"),
    )
    .unwrap();
    let (status, headers, bytes) = raw_get(&app, &path).await;
    assert_eq!(status, 200);
    assert_eq!(headers["x-content-type-options"], "nosniff");
    assert!(headers["content-disposition"]
        .to_str()
        .unwrap()
        .starts_with("attachment"));
    assert_eq!(bytes, TEST_PDF);
    let preview = raw_get(&app, &format!("{path}/preview")).await;
    assert_eq!(preview.0, 200);
    assert_eq!(preview.1["content-type"], "application/pdf");
    assert!(preview.1["content-security-policy"]
        .to_str()
        .unwrap()
        .contains("sandbox"));
    let foreign = path.replace(conversation, &Uuid::now_v7().to_string());
    assert_eq!(raw_get(&app, &foreign).await.0, 404);
}

#[tokio::test]
async fn historical_citations_can_be_recovered_idempotently() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"legacy-file"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    let message = &snapshot["messages"]["items"][1];
    assert_eq!(message["files"][0]["status"], "unavailable");
    let output = std::env::temp_dir()
        .join("beeteam-test-workspaces")
        .join(id(&agent))
        .join("output/example.pdf");
    std::fs::write(&output, TEST_PDF).unwrap();
    let conversation = sent.1["conversationId"].as_str().unwrap();
    let path = format!(
        "/api/v2/agent-conversations/{conversation}/messages/{}/recover-files",
        id(message)
    );
    let key = Uuid::new_v4();
    let recovered = request_key(&app, "POST", &path, Value::Null, ver(message), key).await;
    assert_eq!(recovered.0, 200, "{recovered:?}");
    assert_eq!(recovered.1["files"][0]["status"], "available");
    assert_eq!(
        request_key(&app, "POST", &path, Value::Null, ver(message), key).await,
        recovered
    );
    {
        use axum::{body::Body, http::Request};
        use http_body_util::BodyExt;
        use tower::ServiceExt;
        let response = app.clone().oneshot(Request::builder().method("POST").uri("/mcp")
            .header("host","127.0.0.1").header("content-type","application/json")
            .header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25")
            .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
                "name":"recoverAgentConversationMessageFiles",
                "arguments":{"params":{"conversationId":conversation,"messageId":id(message)},"expectedVersion":ver(message).unwrap(),"idempotencyKey":key}
            }}).to_string())).unwrap()).await.unwrap();
        let result: Value =
            serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes())
                .unwrap();
        assert_eq!(result["result"]["isError"], false, "{result}");
        assert_eq!(result["result"]["structuredContent"]["data"], recovered.1);
    }
    let stale = request_key(
        &app,
        "POST",
        &path,
        Value::Null,
        ver(message),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(stale.0, 412, "{stale:?}");
    let foreign = path.replace(conversation, &Uuid::now_v7().to_string());
    assert_eq!(
        request_key(
            &app,
            "POST",
            &foreign,
            Value::Null,
            ver(message),
            Uuid::new_v4()
        )
        .await
        .0,
        404
    );
    std::fs::remove_file(output).unwrap();
}

#[tokio::test]
async fn invalid_pdf_is_download_only() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"fake-pdf"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    let message = &snapshot["messages"]["items"][1];
    let file = &message["files"][0];
    assert_eq!(file["mediaType"], "application/octet-stream");
    let path = format!(
        "/api/v2/agent-conversations/{}/messages/{}/files/{}",
        sent.1["conversationId"].as_str().unwrap(),
        id(message),
        id(file)
    );
    assert_eq!(raw_get(&app, &format!("{path}/preview")).await.0, 404);
    let (status, headers, bytes) = raw_get(&app, &path).await;
    assert_eq!(status, 200);
    assert_eq!(headers["content-type"], "application/octet-stream");
    assert_eq!(bytes, b"<html>not a pdf");
    std::fs::remove_file(
        std::env::temp_dir()
            .join("beeteam-test-workspaces")
            .join(id(&agent))
            .join("output/example.pdf"),
    )
    .unwrap();
}

#[tokio::test]
async fn reconciled_completed_turn_captures_generated_files() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"uncertain-file"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &sent.1, "uncertain").await;
    let reconciled = request_key(
        &app,
        "POST",
        &format!("/api/v2/agent-requests/{}/reconcile", id(&sent.1)),
        Value::Null,
        ver(&snapshot["request"]),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(reconciled.0, 200, "{reconciled:?}");
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    let message = &snapshot["messages"]["items"][1];
    assert_eq!(message["files"][0]["status"], "available", "{message}");
    std::fs::remove_file(
        std::env::temp_dir()
            .join("beeteam-test-workspaces")
            .join(id(&agent))
            .join("output/example.pdf"),
    )
    .unwrap();
}
