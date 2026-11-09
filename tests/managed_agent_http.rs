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
            let text = text.rsplit("\nUser message:\n").next().unwrap_or(text);
            events
                .send(IntegratedEvent::Accepted("test-turn".into()))
                .await
                .unwrap();
            if text == "approve" || text == "decline" {
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
                        assert_eq!(accept, text == "approve")
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
                .send(IntegratedEvent::Text("Res".into()))
                .await
                .unwrap();
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

#[tokio::test]
async fn owned_requests_continue_without_external_binding() {
    let (app, agent, _, provider) = fixture().await;
    let root = format!("/api/v2/agents/{}", id(&agent));
    let config = json!({"provider":"codex","projectRoot":std::env::temp_dir(),"toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    let response = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        config,
        ver(&agent),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(response.0, 200, "{response:?}");
    let key = Uuid::new_v4();
    let first = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"hello"}),
        None,
        key,
    )
    .await;
    assert_eq!(first.0, 202, "{first:?}");
    let replay = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"hello"}),
        None,
        key,
    )
    .await;
    assert_eq!(first, replay);
    let mut snapshot = Value::Null;
    for _ in 0..100 {
        snapshot = get(
            &app,
            &format!("/api/v2/agent-requests/{}", first.1["id"].as_str().unwrap()),
        )
        .await;
        if snapshot["request"]["state"] == "completed" {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    assert_eq!(snapshot["request"]["state"], "completed", "{snapshot}");
    let spec: Value = serde_json::from_str(include_str!(
        "../docs/proposals/managed-agents-openapi.json"
    ))
    .unwrap();
    beeteam::dto::contracts::validate_schema(
        &spec,
        &spec["components"]["schemas"]["RequestSnapshot"],
        &snapshot,
    )
    .unwrap();
    assert_eq!(snapshot["messages"]["items"].as_array().unwrap().len(), 2);
    assert_eq!(snapshot["messages"]["items"][1]["content"], "Response");
    assert_eq!(provider.0.load(Ordering::SeqCst), 1);
    let next = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"again","conversationId":first.1["conversationId"]}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(next.0, 202, "{next:?}");
    assert!(!snapshot.to_string().contains("externalId"));
}

async fn configured() -> (axum::Router, Value, Value, Arc<TestProvider>) {
    let (app, a, t, p) = fixture().await;
    let cfg = json!({"provider":"codex","projectRoot":std::env::temp_dir(),"toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    let r = request_key(
        &app,
        "PUT",
        &format!("/api/v2/agents/{}/execution-config", id(&a)),
        cfg,
        ver(&a),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(r.0, 200, "{r:?}");
    (app, a, t, p)
}
async fn wait_state(app: &axum::Router, r: &Value, state: &str) -> Value {
    for _ in 0..150 {
        let v = get(app, &format!("/api/v2/agent-requests/{}", id(r))).await;
        if v["request"]["state"] == state {
            return v;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("State {state} not reached")
}
#[tokio::test]
async fn queue_serializes_cancel_and_configuration_is_guarded() {
    let (app, a, _, p) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&a));
    let first = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"hold"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(first.0, 202);
    wait_state(&app, &first.1, "running").await;
    let next = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"next"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(next.0, 202);
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    assert_eq!(p.0.load(Ordering::SeqCst), 1);
    let snap = get(&app, &format!("/api/v2/agent-requests/{}", id(&first.1))).await;
    let cancel = request_key(
        &app,
        "POST",
        &format!("/api/v2/agent-requests/{}/cancel", id(&first.1)),
        Value::Null,
        ver(&snap["request"]),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(cancel.0, 200, "{cancel:?}");
    wait_state(&app, &first.1, "cancelled").await;
    wait_state(&app, &next.1, "completed").await;
    assert_eq!(p.0.load(Ordering::SeqCst), 2);
}
#[tokio::test]
async fn approval_targets_original_request() {
    let (app, a, _, _) = configured().await;
    let r = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&a)),
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snap = wait_state(&app, &r.1, "awaiting_approval").await;
    let approval = &snap["approvals"][0];
    let result = request_key(
        &app,
        "POST",
        &format!("/api/v2/agent-approvals/{}/decision", id(approval)),
        json!({"decision":"accept"}),
        ver(approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(result.0, 200, "{result:?}");
    wait_state(&app, &r.1, "completed").await;
}
#[tokio::test]
async fn rejects_external_ids_and_conflicting_idempotency() {
    let (app, a, _, _) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&a));
    let key = Uuid::new_v4();
    let r = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"hello","externalId":"desktop"}),
        None,
        key,
    )
    .await;
    assert_eq!(r.0, 400);
    let r = request_key(&app, "POST", &path, json!({"content":"hello"}), None, key).await;
    assert_eq!(r.0, 202);
    let r = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"different"}),
        None,
        key,
    )
    .await;
    assert_eq!(r.0, 409);
}

#[tokio::test]
async fn decline_is_not_reported_as_completed() {
    let (app, a, _, _) = configured().await;
    let r = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&a)),
        json!({"content":"decline"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snap = wait_state(&app, &r.1, "awaiting_approval").await;
    let approval = &snap["approvals"][0];
    assert!(approval["description"]
        .as_str()
        .unwrap()
        .contains("example.test"));
    let result = request_key(
        &app,
        "POST",
        &format!("/api/v2/agent-approvals/{}/decision", id(approval)),
        json!({"decision":"decline"}),
        ver(approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(result.0, 200, "{result:?}");
    wait_state(&app, &r.1, "failed").await;
}
#[tokio::test]
async fn mcp_and_http_share_the_original_receipt() {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, a, _, _) = configured().await;
    let key = Uuid::new_v4();
    let body = json!({"content":"same request"});
    let first = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&a)),
        body.clone(),
        None,
        key,
    )
    .await;
    let response=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"sendAgentRequest","arguments":{"params":{"agentId":id(&a).to_uppercase()},"body":body,"idempotencyKey":key}}}).to_string())).unwrap()).await.unwrap();
    let result: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(result["result"]["isError"], false, "{result}");
    assert_eq!(result["result"]["structuredContent"]["data"], first.1);
}
