mod support;
use serde_json::{json, Value};
use support::*;
fn session(id: &str) -> Value {
    json!({"harness":"codex","installationId":"isolated-test-install","externalId":id,"projectRoot":"/isolated/project"})
}

#[tokio::test]
async fn duplicate_destination_rolls_back_creation_and_relative_roots_are_rejected() {
    let app = app().await;
    let body = json!({"agent":{"name":"First"},"session":session("shared")});
    ok(&app, "POST", "/api/v2/agents/with-session", body, None).await;
    let before = get(&app, "/api/v2/agents").await;
    let failure = request(
        &app,
        "POST",
        "/api/v2/agents/with-session",
        json!({"agent":{"name":"Must not persist"},"session":session("shared")}),
        None,
    )
    .await;
    assert_eq!(failure.0, 409);
    assert_eq!(get(&app, "/api/v2/agents").await, before);
    let mut relative = session("new");
    relative["projectRoot"] = json!("relative/path");
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v2/agents/with-session",
            json!({"agent":{"name":"Invalid root"},"session":relative}),
            None
        )
        .await
        .0,
        400
    );
    assert_eq!(get(&app, "/api/v2/agents").await, before);
}

#[tokio::test]
async fn archive_closes_binding_and_cross_provider_replacement_remains_auditable() {
    let app = app().await;
    let created = ok(
        &app,
        "POST",
        "/api/v2/agents/with-session",
        json!({"agent":{"name":"Lifecycle"},"session":session("codex-id")}),
        None,
    )
    .await;
    let route = format!("/api/v2/agents/{}/session-binding", id(&created["agent"]));
    let mut claude = session("claude-id");
    claude["harness"] = json!("claude-code");
    claude["projectRoot"] = json!("C:/other/project");
    let next = ok(
        &app,
        "POST",
        &route,
        json!({"session":claude,"expectedBindingId":id(&created["sessionBinding"])}),
        ver(&created["agent"]),
    )
    .await;
    assert_eq!(next["sessionBinding"]["harness"], "claude-code");
    ok(
        &app,
        "PUT",
        &format!("/api/v2/agents/{}/archive", id(&created["agent"])),
        json!({"archived":true}),
        ver(&next["agent"]),
    )
    .await;
    let history = get(&app, &format!("{route}/history")).await;
    assert_eq!(history["total"], 2);
    assert!(history["items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|b| !b["endedAt"].is_null()));
    assert_eq!(
        get(&app, "/api/v2/agents/available-for-session").await["total"],
        0
    );
    let reuse = ok(
        &app,
        "POST",
        "/api/v2/agents/with-session",
        json!({"agent":{"name":"New owner"},"session":session("codex-id")}),
        None,
    )
    .await;
    assert_eq!(reuse["sessionBinding"]["externalId"], "codex-id");
}

#[cfg(feature = "mcp")]
#[tokio::test]
async fn mcp_and_http_share_atomic_binding_replay() {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let app = app().await;
    let key = uuid::Uuid::new_v4();
    let body = json!({"agent":{"name":"MCP bound"},"session":session("mcp")});
    let response=app.clone().oneshot(Request::builder().method("POST").uri("/mcp")
        .header("host","127.0.0.1").header("content-type","application/json")
        .header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"createAgentWithSession","arguments":{"body":body,"actor":{"kind":"human"},"idempotencyKey":key}}}).to_string())).unwrap()).await.unwrap();
    let rpc: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_ne!(rpc["result"]["isError"], true, "{rpc}");
    let data = rpc["result"]["structuredContent"]["data"].clone();
    assert_eq!(
        request_key(&app, "POST", "/api/v2/agents/with-session", body, None, key).await,
        (201, data)
    );
}
#[tokio::test]
async fn create_claim_and_explicit_switch_preserve_history_and_replay() {
    let app = app().await;
    let body = json!({"agent":{"name":"Bound worker"},"session":session("first")});
    let key = uuid::Uuid::new_v4();
    let (status, created) = request_key(
        &app,
        "POST",
        "/api/v2/agents/with-session",
        body.clone(),
        None,
        key,
    )
    .await;
    assert_eq!(status, 201, "{created}");
    let agent = &created["agent"];
    let binding = &created["sessionBinding"];
    assert_eq!(binding["externalId"], "first");
    assert_eq!(binding["verification"], "declared");
    assert_eq!(
        request_key(&app, "POST", "/api/v2/agents/with-session", body, None, key).await,
        (201, created.clone())
    );
    assert_eq!(
        get(&app, "/api/v2/agents/available-for-session").await["total"],
        0
    );
    let endpoint = format!("/api/v2/agents/{}/session-binding", id(agent));
    assert_eq!(
        request(
            &app,
            "POST",
            &endpoint,
            json!({"session":session("other"),"expectedBindingId":null}),
            ver(agent)
        )
        .await
        .0,
        409
    );
    let switched = ok(
        &app,
        "POST",
        &endpoint,
        json!({"session":session("other"),"expectedBindingId":id(binding)}),
        ver(agent),
    )
    .await;
    let history = get(&app, &format!("{endpoint}/history")).await;
    assert_eq!(history["total"], 2);
    let old = history["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|b| b["id"] == binding["id"])
        .unwrap();
    assert!(!old["endedAt"].is_null());
    assert_eq!(old["externalId"], "first");
    assert_eq!(switched["sessionBinding"]["externalId"], "other");
    let stale = request(
        &app,
        "POST",
        &endpoint,
        json!({"session":session("third"),"expectedBindingId":id(binding)}),
        ver(&switched["agent"]),
    )
    .await;
    assert_eq!(stale.0, 409, "{stale:?}");
}
#[tokio::test]
async fn concurrent_claims_have_one_winner_and_legacy_refs_are_not_active() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Available worker"}),
        None,
    )
    .await;
    ok(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/chat-references", id(&agent)),
        json!({"harness":"codex","externalId":"legacy","label":"Reference only"}),
        ver(&agent),
    )
    .await;
    let agent = get(&app, &format!("/api/v2/agents/{}", id(&agent))).await;
    assert_eq!(
        get(&app, "/api/v2/agents/available-for-session").await["total"],
        1
    );
    let route = format!("/api/v2/agents/{}/session-binding", id(&agent));
    let (a, b) = tokio::join!(
        request(
            &app,
            "POST",
            &route,
            json!({"session":session("a"),"expectedBindingId":null}),
            ver(&agent)
        ),
        request(
            &app,
            "POST",
            &route,
            json!({"session":session("b"),"expectedBindingId":null}),
            ver(&agent)
        )
    );
    let mut codes = [a.0, b.0];
    codes.sort();
    assert_eq!(codes, [200, 412], "{a:?} {b:?}");
    assert_eq!(get(&app, &format!("{route}/history")).await["total"], 1);
}

#[tokio::test]
async fn concurrent_agents_cannot_own_the_same_destination() {
    let app=app().await;
    let a=ok(&app,"POST","/api/v2/agents",json!({"name":"Owner A"}),None).await;
    let b=ok(&app,"POST","/api/v2/agents",json!({"name":"Owner B"}),None).await;
    let left=format!("/api/v2/agents/{}/session-binding",id(&a));
    let right=format!("/api/v2/agents/{}/session-binding",id(&b));
    let body=json!({"session":session("exclusive-session"),"expectedBindingId":null});
    let (a,b)=tokio::join!(request(&app,"POST",&left,body.clone(),ver(&a)),request(&app,"POST",&right,body,ver(&b)));
    let mut codes=[a.0,b.0];codes.sort();assert_eq!(codes,[200,409],"{a:?} {b:?}");
    assert_eq!(get(&app,"/api/v2/agents/available-for-session").await["total"],1);
}
