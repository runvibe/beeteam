mod support;
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig},
    dto::session_delivery::SessionDestination,
    repositories::{database::DatabaseRepository, integrated_provider::*},
    routes::create_router,
    state::AppState,
};
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc,
};
use support::*;
use tokio::sync::mpsc;
use uuid::Uuid;
struct TestProvider(AtomicUsize, AtomicBool);
impl IntegratedProvider for TestProvider {
    fn default_workspace(&self, agent: Uuid) -> Result<String, beeteam::dto::session_delivery::SessionFailure> {
        let path = std::env::temp_dir().join("beeteam-test-workspaces").join(agent.to_string());
        std::fs::create_dir_all(&path).unwrap();
        Ok(path.to_str().unwrap().into())
    }


    fn create<'a>(&'a self, _root: &'a str, _profile: &'a Value) -> ProviderFuture<'a, String> {
        Box::pin(async move {
            self.0.fetch_add(1, Ordering::SeqCst);
            if self.1.swap(false, Ordering::SeqCst) {
                return Err(beeteam::dto::session_delivery::SessionFailure::new(
                    "needs_auth",
                    "Sign in first",
                    false,
                ));
            }
            Ok(Uuid::new_v4().to_string())
        })
    }
    fn inspect<'a>(
        &'a self,
        _target: &'a SessionDestination,
        _profile: &'a Value,
    ) -> ProviderFuture<'a, Value> {
        Box::pin(async {
            Ok(
                json!({"readiness":"ready","tools":{"webSearch":"disabled","networkAccess":false,"skills":[],"mcpServers":[]}}),
            )
        })
    }
    fn run<'a>(
        &'a self,
        _target: &'a SessionDestination,
        text: &'a str,
        _profile: &'a Value,
        events: mpsc::Sender<IntegratedEvent>,
        mut controls: mpsc::Receiver<Control>,
    ) -> ProviderFuture<'a, ()> {
        Box::pin(async move {
            assert!(text.contains("Bee Team persisted execution context"));
            let text = text.rsplit("\nUser message:\n").next().unwrap_or(text);
            events
                .send(IntegratedEvent::Accepted("test-turn".into()))
                .await
                .unwrap();
            if text == "approve" {
                let aid = Uuid::now_v7();
                events
                    .send(IntegratedEvent::Approval {
                        approval_id: aid,
                        kind: "network".into(),
                        title: "Test".into(),
                        description: "Isolated test".into(),
                        command: None,
                        host: Some("example.test".into()),
                        paths: vec![],
                    })
                    .await
                    .unwrap();
                match controls.recv().await {
                    Some(Control::Decision {
                        approval_id,
                        accept,
                    }) => {
                        assert_eq!(approval_id, aid);
                        assert!(accept)
                    }
                    _ => panic!("missing approval"),
                }
            }
            if text == "hold" {
                assert!(matches!(controls.recv().await, Some(Control::Cancel)));
                events.send(IntegratedEvent::Cancelled).await.unwrap();
                return Ok(());
            }
            events
                .send(IntegratedEvent::Text("Response".into()))
                .await
                .unwrap();
            events.send(IntegratedEvent::Completed).await.unwrap();
            Ok(())
        })
    }
}
async fn test_local_peer(
    mut request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    request.extensions_mut().insert(axum::extract::ConnectInfo(
        "127.0.0.1:40000".parse::<std::net::SocketAddr>().unwrap(),
    ));
    if !request.headers().contains_key("host") {
        request
            .headers_mut()
            .insert("host", "127.0.0.1".parse().unwrap());
    }
    next.run(request).await
}
async fn fixture() -> (axum::Router, Value, Value, Arc<TestProvider>) {
    fixture_with_origins(CorsConfig::Permissive, CorsConfig::Permissive).await
}
async fn fixture_with_origins(
    api_origins: CorsConfig,
    mcp_origins: CorsConfig,
) -> (axum::Router, Value, Value, Arc<TestProvider>) {
    let temp = std::env::temp_dir().join(format!("beeteam-chat-test-{}.sql", Uuid::new_v4()));
    let url = format!("sqlite://{}", temp.to_string_lossy().replace('\\', "/"));
    let db = if std::env::var("BEE_TEST_DRIVER").as_deref() == Ok("postgres") {
        let (_, pool) = support::app_with_pool().await;
        DatabaseRepository::new(pool)
    } else {
        DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
            .await
            .unwrap()
    };
    let provider = Arc::new(TestProvider(AtomicUsize::new(0), AtomicBool::new(false)));
    let state = AppState::new(db).with_leader_chat_provider(provider.clone(), "isolated".into());
    let config = AppConfig {
        database_driver: DatabaseDriver::Sqlite,
        database_url: url,
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: api_origins,
        body_limit_bytes: 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: cfg!(feature = "mcp"),
            path: "/mcp".into(),
            cors: mcp_origins,
        },
    };
    let app = create_router(state, &config).layer(axum::middleware::from_fn(test_local_peer));
    let agent = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Chat leader"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"Chat team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let agent = get(&app, &format!("/api/v2/agents/{}", id(&agent))).await;
    (app, agent, team, provider)
}
async fn chat(app: &axum::Router, agent: &Value, team: &Value) -> Value {
    let key = Uuid::new_v4();
    let route = format!("/api/v2/agents/{}/integrated-session", id(agent));
    let body = json!({"expectedBindingId":null});
    let first = request_key(app, "POST", &route, body.clone(), ver(agent), key).await;
    assert_eq!(first.0, 201, "{first:?}");
    let replay = request_key(app, "POST", &route, body, ver(agent), key).await;
    assert_eq!(first, replay);
    ok(app,"POST","/api/v2/leader-chats",json!({"teamId":id(team),"leaderAgentId":id(agent),"bindingId":first.1["bindingId"],"title":"Planning"}),None).await
}
async fn wait_snapshot(app: &axum::Router, chat: &Value, approval: bool) -> Value {
    for _ in 0..100 {
        let snap = get(app, &format!("/api/v2/leader-chats/{}", id(chat))).await;
        if if approval {
            !snap["pendingApprovals"].as_array().unwrap().is_empty()
        } else {
            snap["activeTurn"].is_null() && snap["messages"].as_array().unwrap().len() > 1
        } {
            return snap;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("state did not arrive")
}
#[tokio::test]
async fn session_creation_replay_chat_send_and_persistent_snapshot() {
    let (app, agent, team, provider) = fixture().await;
    let chat = chat(&app, &agent, &team).await;
    assert_eq!(provider.0.load(Ordering::SeqCst), 1);
    let key = Uuid::new_v4();
    let body =
        json!({"clientMessageId":Uuid::new_v4(),"bindingId":chat["bindingId"],"content":"hello"});
    let route = format!("/api/v2/leader-chats/{}/messages", id(&chat));
    let first = request_key(&app, "POST", &route, body.clone(), None, key).await;
    assert_eq!(first.0, 202, "{first:?}");
    let snap = wait_snapshot(&app, &chat, false).await;
    assert_eq!(snap["messages"][1]["content"], "Response");
    assert!(snap["messages"][0].get("initialResult").is_none());
    assert_eq!(
        first,
        request_key(&app, "POST", &route, body, None, key).await
    );
    let events = snap["eventCursor"].as_str().unwrap();
    assert!(events.starts_with(id(&chat)));
}
#[tokio::test]
async fn approval_roundtrip_and_cancel_confirmed_by_provider() {
    let (app, agent, team, _) = fixture().await;
    let chat = chat(&app, &agent, &team).await;
    let route = format!("/api/v2/leader-chats/{}/messages", id(&chat));
    ok(
        &app,
        "POST",
        &route,
        json!({"clientMessageId":Uuid::new_v4(),"bindingId":chat["bindingId"],"content":"approve"}),
        None,
    )
    .await;
    let snap = wait_snapshot(&app, &chat, true).await;
    let approval = &snap["pendingApprovals"][0];
    ok(
        &app,
        "POST",
        &format!(
            "/api/v2/leader-chats/{}/approvals/{}/decision",
            id(&chat),
            id(approval)
        ),
        json!({"decision":"accept"}),
        ver(approval),
    )
    .await;
    wait_snapshot(&app, &chat, false).await;
    let accepted = ok(
        &app,
        "POST",
        &route,
        json!({"clientMessageId":Uuid::new_v4(),"bindingId":chat["bindingId"],"content":"hold"}),
        None,
    )
    .await;
    let turn_route = format!(
        "/api/v2/leader-chats/{}/turns/{}",
        id(&chat),
        id(&accepted["turn"])
    );
    let mut turn = get(&app, &turn_route).await;
    for _ in 0..100 {
        if turn["status"] == "running" {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        turn = get(&app, &turn_route).await;
    }
    ok(
        &app,
        "POST",
        &format!("{turn_route}/cancel"),
        Value::Null,
        ver(&turn),
    )
    .await;
    for _ in 0..100 {
        let t = get(&app, &turn_route).await;
        if t["status"] == "cancelled" {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("not cancelled");
}

#[tokio::test]
async fn bootstrap_failure_replays_without_duplicate_and_new_key_can_retry() {
    let (app, agent, _team, provider) = fixture().await;
    provider.1.store(true, Ordering::SeqCst);
    let route = format!("/api/v2/agents/{}/integrated-session", id(&agent));
    let body = json!({"expectedBindingId":null});
    let key = Uuid::new_v4();
    let first = request_key(&app, "POST", &route, body.clone(), ver(&agent), key).await;
    assert!(first.0 >= 400);
    assert_eq!(first.1["code"], "needs_auth");
    assert_eq!(
        first,
        request_key(&app, "POST", &route, body.clone(), ver(&agent), key).await
    );
    assert_eq!(provider.0.load(Ordering::SeqCst), 1);
    assert_eq!(
        request_key(&app, "POST", &route, body, ver(&agent), Uuid::new_v4())
            .await
            .0,
        201
    );
    assert_eq!(provider.0.load(Ordering::SeqCst), 2);
}
#[tokio::test]
async fn cannot_replace_binding_with_running_turn() {
    let (app, agent, team, provider) = fixture().await;
    let chat = chat(&app, &agent, &team).await;
    let accepted = ok(
        &app,
        "POST",
        &format!("/api/v2/leader-chats/{}/messages", id(&chat)),
        json!({"clientMessageId":Uuid::new_v4(),"bindingId":chat["bindingId"],"content":"hold"}),
        None,
    )
    .await;
    let agent = get(&app, &format!("/api/v2/agents/{}", id(&agent))).await;
    let result = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/integrated-session", id(&agent)),
        json!({"expectedBindingId":chat["bindingId"]}),
        ver(&agent),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(result.1["code"], "session_busy");
    assert_eq!(provider.0.load(Ordering::SeqCst), 1);
    let route = format!(
        "/api/v2/leader-chats/{}/turns/{}",
        id(&chat),
        id(&accepted["turn"])
    );
    for _ in 0..100 {
        let turn = get(&app, &route).await;
        if turn["status"] == "running" {
            ok(
                &app,
                "POST",
                &format!("{route}/cancel"),
                Value::Null,
                ver(&turn),
            )
            .await;
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
}

#[cfg(feature = "mcp")]
#[tokio::test]
async fn http_mcp_bootstrap_share_replay_and_runtime() {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, agent, _, provider) = fixture().await;
    let key = Uuid::new_v4();
    let body = json!({"expectedBindingId":null});
    let route = format!("/api/v2/agents/{}/integrated-session", id(&agent));
    let first = request_key(&app, "POST", &route, body.clone(), ver(&agent), key).await;
    assert_eq!(first.0, 201);
    for (name, args) in [
        (
            "createIntegratedSession",
            json!({"params":{"agentId":id(&agent)},"body":body,"actor":{"kind":"human"},"expectedVersion":ver(&agent),"idempotencyKey":key}),
        ),
        ("getAgentRuntime", json!({"params":{"agentId":id(&agent)}})),
    ] {
        let response=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).to_string())).unwrap()).await.unwrap();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let result: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(result["result"]["isError"], false, "{result}");
        let data = &result["result"]["structuredContent"]["data"];
        let document: Value = serde_json::from_str(include_str!(
            "../docs/proposals/integrated-chat-openapi.json"
        ))
        .unwrap();
        let schema = if name == "createIntegratedSession" {
            "IntegratedSession"
        } else {
            "AgentRuntime"
        };
        beeteam::dto::contracts::validate_schema(
            &document,
            &document["components"]["schemas"][schema],
            data,
        )
        .unwrap();

        if name == "createIntegratedSession" {
            assert_eq!(data, &first.1);
        } else {
            assert_eq!(data["mode"], "integrated");
        }
    }
    assert_eq!(provider.0.load(Ordering::SeqCst), 1);
}

async fn browser_request(
    app: &axum::Router,
    method: &str,
    path: &str,
    host: &str,
    origin: &str,
    body: Value,
) -> u16 {
    use tower::ServiceExt;
    let response = app
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method(method)
                .uri(path)
                .header("host", host)
                .header("origin", origin)
                .header("content-type", "application/json")
                .header("accept", "application/json, text/event-stream")
                .header("mcp-protocol-version", "2025-11-25")
                .header("X-Actor-Kind", "human")
                .header("Idempotency-Key", Uuid::new_v4().to_string())
                .body(axum::body::Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    response.status().as_u16()
}
#[tokio::test]
async fn untrusted_browser_cannot_bootstrap_read_stream_or_trigger_conversation_delivery() {
    let (app, agent, _, provider) = fixture().await;
    for (method, path) in [
        ("GET", format!("/api/v2/agents/{}/runtime", id(&agent))),
        (
            "POST",
            format!("/api/v2/agents/{}/integrated-session", id(&agent)),
        ),
        (
            "GET",
            format!("/api/v2/leader-chats/{}/events", Uuid::now_v7()),
        ),
        ("POST", format!("/api/v2/tasks/{}/comments", Uuid::now_v7())),
    ] {
        assert_eq!(
            browser_request(
                &app,
                method,
                &path,
                "127.0.0.1",
                "https://evil.example",
                json!({})
            )
            .await,
            403,
            "{path}"
        );
    }
    assert_eq!(
        browser_request(
            &app,
            "GET",
            &format!("/api/v2/agents/{}/runtime", id(&agent)),
            "attacker.example",
            "http://localhost:5176",
            Value::Null
        )
        .await,
        403
    );
    if cfg!(feature = "mcp") {
        let body = json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"createIntegratedSession","arguments":{"params":{"agentId":id(&agent)},"body":{"expectedBindingId":null},"actor":{"kind":"human"},"expectedVersion":ver(&agent),"idempotencyKey":Uuid::new_v4()}}});
        assert_eq!(
            browser_request(
                &app,
                "POST",
                "/mcp",
                "127.0.0.1",
                "https://evil.example",
                body
            )
            .await,
            403
        );
    }
    assert_eq!(provider.0.load(Ordering::SeqCst), 0);
    assert_eq!(
        browser_request(
            &app,
            "GET",
            &format!("/api/v2/agents/{}/runtime", id(&agent)),
            "127.0.0.1",
            "http://localhost:5176",
            Value::Null
        )
        .await,
        200
    );
}
#[tokio::test]
async fn explicit_browser_trust_is_scoped_separately_to_api_and_mcp() {
    let (app, agent, _, _) = fixture_with_origins(
        CorsConfig::Restricted(vec!["https://app.example".into()]),
        CorsConfig::Restricted(vec!["https://mcp.example".into()]),
    )
    .await;
    let path = format!("/api/v2/agents/{}/runtime", id(&agent));
    assert_eq!(
        browser_request(
            &app,
            "GET",
            &path,
            "127.0.0.1",
            "https://app.example",
            Value::Null
        )
        .await,
        200
    );
    assert_eq!(
        browser_request(
            &app,
            "GET",
            &path,
            "127.0.0.1",
            "https://mcp.example",
            Value::Null
        )
        .await,
        403
    );
    if cfg!(feature = "mcp") {
        let body = json!({"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}});
        assert_eq!(
            browser_request(
                &app,
                "POST",
                "/mcp",
                "127.0.0.1",
                "https://mcp.example",
                body.clone()
            )
            .await,
            200
        );
        assert_eq!(
            browser_request(
                &app,
                "POST",
                "/mcp",
                "127.0.0.1",
                "https://app.example",
                body
            )
            .await,
            403
        );
    }
}
