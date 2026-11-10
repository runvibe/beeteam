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
    fn default_workspace(
        &self,
        agent: Uuid,
    ) -> Result<String, beeteam::dto::session_delivery::SessionFailure> {
        let path = std::env::temp_dir()
            .join("beeteam-test-workspaces")
            .join(agent.to_string());
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
        target: &'a SessionDestination,
        text: &'a str,
        _profile: &'a Value,
        events: mpsc::Sender<IntegratedEvent>,
        mut controls: mpsc::Receiver<Control>,
    ) -> ProviderFuture<'a, ()> {
        Box::pin(async move {
            assert!(std::path::Path::new(&target.project_root).is_dir());
            assert!(target.project_root.contains("beeteam-test-workspaces"));
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
    let (app, agent, team, provider, _) = fixture_with_repo(api_origins, mcp_origins).await;
    (app, agent, team, provider)
}
async fn fixture_with_repo(
    api_origins: CorsConfig,
    mcp_origins: CorsConfig,
) -> (
    axum::Router,
    Value,
    Value,
    Arc<TestProvider>,
    DatabaseRepository,
) {
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
    let state =
        AppState::new(db.clone()).with_leader_chat_provider(provider.clone(), "isolated".into());
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
    (app, agent, team, provider, db)
}

#[tokio::test]
async fn owned_requests_continue_without_external_binding() {
    let (app, agent, _, provider) = fixture().await;
    let root = format!("/api/v2/agents/{}", id(&agent));
    let config = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
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
    let workspace = std::env::temp_dir()
        .join("beeteam-test-workspaces")
        .join(id(&agent));
    std::fs::remove_dir(&workspace).unwrap(); // Empty isolated test directory only.
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
    let cfg = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
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
async fn team_managed_approvals_follow_current_worker_membership() {
    let (app, worker, _, _) = configured().await;
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Other leader"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({
            "name":"Workers", "leaderId":id(&leader), "workerIds":[id(&worker)],
            "coordinationContext":manual()
        }),
        None,
    )
    .await;
    let request = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&worker)),
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &request.1, "awaiting_approval").await;
    let url = format!("/api/v2/teams/{}/managed-approvals", id(&team));
    let page = get(&app, &url).await;
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    assert_eq!(page["items"][0]["approval"], snapshot["approvals"][0]);
    assert_eq!(page["items"][0]["request"], snapshot["request"]);
    assert_eq!(
        page["items"][0]["agent"],
        json!({"id":id(&worker),"name":"Chat leader"})
    );
    assert!(page["nextCursor"].is_null());
    let decision = request_key(
        &app,
        "POST",
        &format!(
            "/api/v2/agent-approvals/{}/decision",
            id(&snapshot["approvals"][0])
        ),
        json!({"decision":"accept"}),
        ver(&snapshot["approvals"][0]),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(decision.0, 200);
    assert_eq!(get(&app, &url).await["items"], json!([]));
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
async fn scoped_decision_rejects_transferred_worker_but_replays_original_decision() {
    use axum::{body::Body, http::Request};
    use beeteam::repositories::records::Record;
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, worker, _, _, db) =
        fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let config = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    assert_eq!(
        request_key(
            &app,
            "PUT",
            &format!("/api/v2/agents/{}/execution-config", id(&worker)),
            config,
            ver(&worker),
            Uuid::new_v4()
        )
        .await
        .0,
        200
    );
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Team leader"}),
        None,
    )
    .await;
    let leader_b = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Other leader"}),
        None,
    )
    .await;
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"First team","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}), None).await;
    let other = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"Second team","leaderId":id(&leader_b),"coordinationContext":manual()}),
        None,
    )
    .await;
    let path = format!("/api/v2/agents/{}/requests", id(&worker));
    let first = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let first_snap = wait_state(&app, &first.1, "awaiting_approval").await;
    let first_approval = &first_snap["approvals"][0];
    let first_path = format!("/api/v2/agent-approvals/{}/decision", id(first_approval));
    let first_body = json!({"decision":"accept","expectedTeamId":id(&team)});
    let key = Uuid::new_v4();
    let accepted = request_key(
        &app,
        "POST",
        &first_path,
        first_body.clone(),
        ver(first_approval),
        key,
    )
    .await;
    assert_eq!(accepted.0, 200, "{accepted:?}");
    wait_state(&app, &first.1, "completed").await;
    let second = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let second_snap = wait_state(&app, &second.1, "awaiting_approval").await;
    let second_approval = &second_snap["approvals"][0];
    let second_path = format!("/api/v2/agent-approvals/{}/decision", id(second_approval));
    for invalid in [
        json!(null),
        json!(7),
        json!(Uuid::new_v4().to_string()),
        json!(id(&team).replace('-', "")),
    ] {
        let response = request_key(
            &app,
            "POST",
            &second_path,
            json!({"decision":"accept","expectedTeamId":invalid}),
            ver(second_approval),
            Uuid::new_v4(),
        )
        .await;
        assert_eq!(response.0, 400, "{response:?}");
        assert_eq!(response.1["code"], "invalid_request");
    }
    let (store, _) = db.stores();
    let mut unit = store.begin().await.unwrap();
    let worker_id = Uuid::parse_str(id(&worker)).unwrap();
    let membership = unit
        .records
        .list("memberships")
        .into_iter()
        .find(|r| r.reference("agentId") == Some(worker_id))
        .unwrap()
        .id;
    unit.records
        .get_mut("memberships", membership)
        .unwrap()
        .deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    let mut unit = store.begin().await.unwrap();
    unit.records.insert(Record::new(
        "memberships",
        json!({"agentId":worker_id,"teamId":id(&other)}),
    ));
    unit.commit().await.unwrap();
    let rejected = request_key(
        &app,
        "POST",
        &second_path,
        first_body.clone(),
        ver(second_approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(rejected.0, 409, "{rejected:?}");
    assert_eq!(rejected.1["code"], "approval_team_mismatch");
    let replay = request_key(
        &app,
        "POST",
        &first_path,
        first_body,
        ver(first_approval),
        key,
    )
    .await;
    assert_eq!(replay, accepted);
    let mcp=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"decideAgentRequestApproval","arguments":{"params":{"approvalId":id(first_approval)},"body":{"decision":"accept","expectedTeamId":id(&team)},"expectedVersion":ver(first_approval),"idempotencyKey":key}}}).to_string())).unwrap()).await.unwrap();
    let response: Value =
        serde_json::from_slice(&mcp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(response["result"]["isError"], false, "{response}");
    assert_eq!(response["result"]["structuredContent"]["data"], accepted.1);
    let mcp=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"decideAgentRequestApproval","arguments":{"params":{"approvalId":id(second_approval)},"body":{"decision":"accept","expectedTeamId":id(&team)},"expectedVersion":ver(second_approval),"idempotencyKey":Uuid::new_v4()}}}).to_string())).unwrap()).await.unwrap();
    let response: Value =
        serde_json::from_slice(&mcp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(response["result"]["isError"], true, "{response}");
    assert_eq!(
        response["result"]["structuredContent"]["code"],
        "approval_team_mismatch"
    );
    let direct = request_key(
        &app,
        "POST",
        &second_path,
        json!({"decision":"accept"}),
        ver(second_approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(direct.0, 200, "{direct:?}");
}

#[tokio::test]
async fn team_approvals_page_by_uuid_and_follow_transfer() {
    use axum::{body::Body, http::Request};
    use beeteam::repositories::records::Record;
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, worker, worker_leads, _, db) =
        fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Leader A"}),
        None,
    )
    .await;
    let leader_b = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Leader B"}),
        None,
    )
    .await;
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"A","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}), None).await;
    let other = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"B","leaderId":id(&leader_b),"coordinationContext":manual()}),
        None,
    )
    .await;
    let base = format!("/api/v2/teams/{}/managed-approvals", id(&team));
    assert_eq!(get(&app, &base).await["items"], json!([]));
    let (store, _) = db.stores();
    let mut unit = store.begin().await.unwrap();
    let worker_id = Uuid::parse_str(id(&worker)).unwrap();
    let conversation = Uuid::now_v7();
    let request_id = unit.records.insert(Record::new("managed_requests", json!({
        "agentId":worker_id,"conversationId":conversation,"taskId":null,"configurationVersion":1,
        "state":"completed","origin":{"transport":"http","label":null},"error":null
    })));
    let mut ids = Vec::new();
    for n in 0..53 {
        let row = Record::new(
            "managed_approvals",
            json!({"agentId":worker_id,"requestId":request_id,
            "state":"pending","kind":"network","description":format!("Approval {n}"),"expiresAt":null}),
        );
        ids.push(row.id.to_string());
        unit.records.insert(row);
    }
    for state in ["accepted", "expired"] {
        unit.records.insert(Record::new("managed_approvals", json!({"agentId":worker_id,"requestId":request_id,"state":state,"kind":"network","description":"Excluded","expiresAt":null})));
    }
    let mut deleted = Record::new(
        "managed_approvals",
        json!({"agentId":worker_id,"requestId":request_id,"state":"pending","kind":"network","description":"Deleted","expiresAt":null}),
    );
    deleted.deleted_at = Some(chrono::Utc::now());
    unit.records.insert(deleted);
    unit.records
        .get_mut("agents", worker_id)
        .unwrap()
        .archived_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    ids.sort_by(|a, b| b.cmp(a));

    let first = get(&app, &base).await;
    assert_eq!(first["items"].as_array().unwrap().len(), 50);
    let got: Vec<_> = first["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| id(&x["approval"]).to_owned())
        .collect();
    assert_eq!(got, ids[..50]);
    let cursor = first["nextCursor"].as_str().unwrap();
    let second = get(&app, &format!("{base}?cursor={cursor}")).await;
    let got: Vec<_> = second["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| id(&x["approval"]).to_owned())
        .collect();
    assert_eq!(got, ids[50..]);
    assert!(second["nextCursor"].is_null());
    assert_eq!(
        get(&app, &format!("{base}?limit=1")).await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    for url in [
        format!("{base}?limit=0"),
        format!("{base}?limit=101"),
        format!("{base}?cursor=invalid"),
        format!(
            "/api/v2/teams/{}/managed-approvals?cursor={cursor}",
            id(&other)
        ),
    ] {
        let response = request(&app, "GET", &url, json!({}), None).await;
        assert_eq!(response.0, 400, "{response:?}");
        assert_eq!(response.1["code"], "invalid_request");
    }
    let missing = request(
        &app,
        "GET",
        &format!("/api/v2/teams/{}/managed-approvals", Uuid::now_v7()),
        json!({}),
        None,
    )
    .await;
    assert_eq!(missing.0, 404);
    assert_eq!(missing.1["code"], "not_found");
    let mcp=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"listTeamManagedApprovals","arguments":{"params":{"teamId":id(&team)}}}}).to_string())).unwrap()).await.unwrap();
    let result: Value =
        serde_json::from_slice(&mcp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(result["result"]["isError"], false, "{result}");
    assert_eq!(result["result"]["structuredContent"]["data"], first);
    assert_eq!(
        get(
            &app,
            &format!("/api/v2/teams/{}/managed-approvals", id(&worker_leads))
        )
        .await["items"],
        json!([])
    );

    let mut unit = store.begin().await.unwrap();
    unit.records
        .get_mut("managed_approvals", Uuid::parse_str(&ids[50]).unwrap())
        .unwrap()
        .data["state"] = json!("accepted");
    unit.commit().await.unwrap();
    assert_eq!(
        get(&app, &format!("{base}?cursor={cursor}")).await["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );

    let mut unit = store.begin().await.unwrap();
    let membership = unit
        .records
        .list("memberships")
        .into_iter()
        .find(|r| r.reference("agentId") == Some(worker_id))
        .unwrap()
        .id;
    let row = unit.records.get_mut("memberships", membership).unwrap();
    row.deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    assert_eq!(get(&app, &base).await["items"], json!([]));
    let mut unit = store.begin().await.unwrap();
    unit.records.insert(Record::new(
        "memberships",
        json!({"agentId":worker_id,"teamId":id(&other)}),
    ));
    unit.commit().await.unwrap();
    assert_eq!(
        get(
            &app,
            &format!("/api/v2/teams/{}/managed-approvals?limit=100", id(&other))
        )
        .await["items"]
            .as_array()
            .unwrap()
            .len(),
        52
    );
}

#[tokio::test]
async fn team_approvals_hydrate_one_consistent_snapshot_during_writes() {
    use beeteam::repositories::records::Record;
    let (app, worker, _, _, db) =
        fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Snapshot leader"}),
        None,
    )
    .await;
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"Snapshot team","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}), None).await;
    let route = format!("/api/v2/teams/{}/managed-approvals", id(&team));
    assert_eq!(get(&app, &route).await["items"], json!([]));
    let (store, _) = db.stores();
    let worker_id = Uuid::parse_str(id(&worker)).unwrap();
    let mut unit = store.begin().await.unwrap();
    unit.records.get_mut("agents", worker_id).unwrap().data["name"] = json!("Snapshot A");
    let request_id = unit.records.insert(Record::new("managed_requests", json!({
        "agentId":worker_id,"conversationId":Uuid::now_v7(),"taskId":null,"configurationVersion":1,
        "state":"completed","origin":{"transport":"http","label":null},"error":null
    })));
    unit.records.insert(Record::new(
        "managed_approvals",
        json!({
            "agentId":worker_id,"requestId":request_id,"state":"pending","kind":"network",
            "description":"Snapshot","expiresAt":null
        }),
    ));
    unit.commit().await.unwrap();
    let writer_store = store.clone();
    let writer = tokio::spawn(async move {
        for i in 0..50 {
            let mut u = writer_store.begin().await.unwrap();
            let (name, state) = if i % 2 == 0 {
                ("Snapshot B", "failed")
            } else {
                ("Snapshot A", "completed")
            };
            u.records.get_mut("agents", worker_id).unwrap().data["name"] = json!(name);
            u.records
                .get_mut("managed_requests", request_id)
                .unwrap()
                .data["state"] = json!(state);
            u.commit().await.unwrap();
            tokio::task::yield_now().await;
        }
    });
    for _ in 0..50 {
        let page = get(&app, &route).await;
        let item = &page["items"][0];
        assert!(
            matches!(
                (
                    item["agent"]["name"].as_str(),
                    item["request"]["state"].as_str()
                ),
                (Some("Snapshot A"), Some("completed")) | (Some("Snapshot B"), Some("failed"))
            ),
            "{page}"
        );
    }
    writer.await.unwrap();
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

#[tokio::test]
async fn automatic_workspace_is_resolved_and_replayed() {
    let (app, agent, _, _) = fixture().await;
    let root = format!("/api/v2/agents/{}", id(&agent));
    let body = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    let key = Uuid::new_v4();
    let first = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        body.clone(),
        ver(&agent),
        key,
    )
    .await;
    assert_eq!(first.0, 200, "{first:?}");
    let replay = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        body,
        ver(&agent),
        key,
    )
    .await;
    assert_eq!(first, replay);
    let state = get(&app, &format!("{root}/execution-config")).await;
    assert!(state["configuration"].get("projectRoot").is_none());
    let path = std::env::temp_dir()
        .join("beeteam-test-workspaces")
        .join(id(&agent));
    let path = path.to_str().unwrap();
    assert!(std::path::Path::new(path).is_dir());
    assert!(path.ends_with(id(&agent)));
    std::fs::remove_dir(path).unwrap(); // Empty isolated test directory only.
    let mut invalid = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    invalid["projectRoot"] = json!(std::env::temp_dir());
    let rejected = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        invalid,
        ver(&state),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(rejected.0, 400, "{rejected:?}");
    let sent = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"hello"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(sent.0, 202, "{sent:?}");
}
