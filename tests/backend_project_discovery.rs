#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig, DEFAULT_MCP_PATH},
    repositories::{
        contracts::{GitInspection, ProjectDiscovery, ResourceStore},
        database::DatabaseRepository,
    },
    routes::create_router,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use support::*;
use tokio::sync::Notify;
use tower::ServiceExt;
#[derive(Default)]
struct Inspector {
    calls: AtomicUsize,
    block_next: AtomicBool,
    started: Notify,
    release: Notify,
}
impl ProjectDiscovery for Inspector {
    fn discover<'a>(
        &'a self,
        roots: &'a [String],
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Vec<GitInspection>> + Send + 'a>> {
        Box::pin(async move {
            self.calls.fetch_add(1, Ordering::SeqCst);
            if self.block_next.swap(false, Ordering::SeqCst) {
                self.started.notify_one();
                self.release.notified().await;
            }
            roots
                .iter()
                .map(|_| GitInspection::unavailable("path_unavailable"))
                .collect()
        })
    }
}
async fn fixture(
    inspector: Arc<dyn ProjectDiscovery>,
) -> (Router, Arc<dyn ResourceStore>, Value, Value) {
    let (db, driver, url) = if std::env::var("BEE_TEST_DRIVER").as_deref() == Ok("postgres") {
        let (_, pool) = app_with_pool().await;
        (
            DatabaseRepository::new(pool),
            DatabaseDriver::Postgres,
            String::new(),
        )
    } else {
        let url = format!(
            "sqlite://{}",
            std::env::temp_dir()
                .join(format!("bee-discovery-{}.sqlite", uuid::Uuid::new_v4()))
                .to_string_lossy()
                .replace('\\', "/")
        );
        (
            DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
                .await
                .unwrap(),
            DatabaseDriver::Sqlite,
            url,
        )
    };
    let (store, _) = db.stores();
    let config = AppConfig {
        database_driver: driver,
        database_url: url,
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 22 * 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: true,
            path: DEFAULT_MCP_PATH.into(),
            cors: CorsConfig::Permissive,
        },
    };
    let app = create_router(AppState::with_project_discovery(db, inspector), &config);
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Discovery"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Discovery","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Discovery","teamId":id(&team)}),
        None,
    )
    .await;
    (app, store, agent, board)
}
fn body(agent: &Value) -> Value {
    json!({"title":"Discovery task","authorAgentId":id(agent),"executorAgentId":id(agent),"coordinationContext":manual(),"workScope":test_project_scope()})
}
async fn rpc(app: &Router, name: &str, args: Value) -> Value {
    let response=app.clone().oneshot(Request::post("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice::<Value>(&response.into_body().collect().await.unwrap().to_bytes())
        .unwrap()["result"]
        .clone()
}
#[tokio::test]
async fn requirements_and_unavailable_registration_are_identical_in_http_and_mcp() {
    let inspector = Arc::new(Inspector::default());
    let (app, _, agent, board) = fixture(inspector.clone()).await;
    let route = format!("/api/v1/boards/{}/tasks", id(&board));
    let valid = body(&agent);
    let mut invalid = vec![
        Value::Null,
        json!({"projects":[]}),
        json!({"projects":[{"key":"app","name":" ","rootPath":"/tmp"}]}),
        json!({"projects":[{"key":"app","name":"App","rootPath":"relative"}]}),
        json!({"projects":valid["workScope"]["projects"],"repositories":[]}),
    ];
    let mut injected = valid["workScope"].clone();
    injected["projects"][0]["discovery"] = json!({"status":"detected"});
    invalid.push(injected);
    for scope in invalid {
        let mut request_body = valid.clone();
        if scope.is_null() {
            request_body.as_object_mut().unwrap().remove("workScope");
        } else {
            request_body["workScope"] = scope;
        }
        assert_eq!(
            request(&app, "POST", &route, request_body.clone(), None)
                .await
                .0,
            400
        );
        let result=rpc(&app,"createTask",json!({"params":{"boardId":id(&board)},"body":request_body,"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4()})).await;
        assert_eq!(result["isError"], true, "{result}");
    }
    assert_eq!(inspector.calls.load(Ordering::SeqCst), 0);
    assert_eq!(get(&app, &route).await["total"], 0);
    let key = uuid::Uuid::new_v4();
    let (status, task) = request_key(&app, "POST", &route, valid.clone(), None, key).await;
    assert_eq!(status, 201, "{task}");
    assert_eq!(
        task["workScope"]["projects"][0]["discovery"]["status"],
        "unavailable"
    );
    assert_eq!(task["workScope"]["repositories"], json!([]));
    let replay=rpc(&app,"createTask",json!({"params":{"boardId":id(&board)},"body":valid,"actor":{"kind":"human"},"idempotencyKey":key})).await;
    assert_eq!(replay["isError"], false);
    assert_eq!(replay["structuredContent"]["data"], task);
    assert_eq!(inspector.calls.load(Ordering::SeqCst), 1);
    let path = format!("/api/v1/tasks/{}", id(&task));
    let before = get(&app, &path).await;
    let patched=rpc(&app,"updateTask",json!({"params":{"taskId":id(&task)},"body":{"workScope":valid["workScope"]},"actor":{"kind":"human"},"expectedVersion":task["version"]})).await;
    assert_eq!(patched["isError"], false, "{patched}");
    assert_eq!(inspector.calls.load(Ordering::SeqCst), 2);
    assert_eq!(
        get(&app, &path).await["version"].as_i64(),
        Some(before["version"].as_i64().unwrap() + 1)
    );
}
#[tokio::test]
async fn discovery_releases_writer_lock_and_rechecks_version_and_concurrent_replays() {
    let inspector = Arc::new(Inspector::default());
    let (app, _, agent, board) = fixture(inspector.clone()).await;
    let route = format!("/api/v1/boards/{}/tasks", id(&board));
    let request_body = body(&agent);
    let key = uuid::Uuid::new_v4();
    inspector.block_next.store(true, Ordering::SeqCst);
    let a = app.clone();
    let r = route.clone();
    let b = request_body.clone();
    let pending = tokio::spawn(async move { request_key(&a, "POST", &r, b, None, key).await });
    tokio::time::timeout(Duration::from_secs(5), inspector.started.notified())
        .await
        .unwrap();
    // The second request must acquire the writer lock and win while the first inspects.
    let (status, winner) = tokio::time::timeout(
        Duration::from_secs(5),
        request_key(&app, "POST", &route, request_body, None, key),
    )
    .await
    .unwrap();
    assert_eq!(status, 201, "{winner}");
    inspector.release.notify_one();
    let replay = pending.await.unwrap();
    assert_eq!(replay.1, winner);
    assert_eq!(get(&app, &route).await["total"], 1);
    let path = format!("/api/v1/tasks/{}", id(&winner));
    let original = get(&app, &path).await;
    inspector.block_next.store(true, Ordering::SeqCst);
    let a = app.clone();
    let p = path.clone();
    let v = ver(&winner);
    let pending = tokio::spawn(async move {
        request(
            &a,
            "PATCH",
            &p,
            json!({"workScope":test_project_scope()}),
            v,
        )
        .await
    });
    tokio::time::timeout(Duration::from_secs(5), inspector.started.notified())
        .await
        .unwrap();
    let changed = tokio::time::timeout(
        Duration::from_secs(5),
        ok(
            &app,
            "PATCH",
            &path,
            json!({"title":"Concurrent edit"}),
            ver(&winner),
        ),
    )
    .await
    .unwrap();
    inspector.release.notify_one();
    assert_eq!(pending.await.unwrap().0, 412);
    let after = get(&app, &path).await;
    assert_eq!(after["title"], changed["title"]);
    assert_eq!(after["workScope"], original["workScope"]);
    assert_eq!(after["version"], changed["version"]);
}
#[tokio::test]
async fn legacy_specification_rules_and_exact_creation_replays_preserve_missing_scope() {
    use beeteam::dto::backend::Outcome;
    use sha2::{Digest, Sha256};
    let inspector = Arc::new(Inspector::default());
    let (app, store, agent, board) = fixture(inspector.clone()).await;
    let route = format!("/api/v1/boards/{}/tasks", id(&board));
    let mut old_body = body(&agent);
    let task = ok(&app, "POST", &route, old_body.clone(), None).await;
    let path = format!("/api/v1/tasks/{}", id(&task));
    let mut unit = store.begin().await.unwrap();
    unit.records
        .get_mut("tasks", uuid::Uuid::parse_str(id(&task)).unwrap())
        .unwrap()
        .data
        .as_object_mut()
        .unwrap()
        .remove("workScope");
    old_body.as_object_mut().unwrap().remove("workScope");
    let mut historical = task.clone();
    historical.as_object_mut().unwrap().remove("workScope");
    let key = uuid::Uuid::new_v4();
    let params = json!({"boardId":id(&board)});
    let hash = Sha256::digest(serde_json::to_vec(&json!([old_body, params, {}])).unwrap())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    unit.save_replay(
        "human:",
        &format!("createTask:{params}"),
        key,
        &hash,
        &Outcome::data(historical.clone()),
    )
    .await
    .unwrap();
    unit.commit().await.unwrap();
    assert!(get(&app, &path).await.get("workScope").is_none());
    assert_eq!(
        request_key(&app, "POST", &route, old_body.clone(), None, key)
            .await
            .1,
        historical
    );
    let replay = rpc(
        &app,
        "createTask",
        json!({"params":params,"body":old_body,"actor":{"kind":"human"},"idempotencyKey":key}),
    )
    .await;
    assert_eq!(replay["structuredContent"]["data"], historical);
    assert_eq!(inspector.calls.load(Ordering::SeqCst), 1);
    let task = ok(
        &app,
        "PATCH",
        &path,
        json!({"title":"Legacy title"}),
        ver(&task),
    )
    .await;
    assert_eq!(
        request(
            &app,
            "PATCH",
            &path,
            json!({"specification":"# New requirements"}),
            ver(&task)
        )
        .await
        .0,
        400
    );
    let changed = ok(
        &app,
        "PATCH",
        &path,
        json!({"specification":"# New requirements","workScope":test_project_scope()}),
        ver(&task),
    )
    .await;
    assert_eq!(changed["specification"], "# New requirements");
    assert!(changed["workScope"].is_object());
}

#[tokio::test]
async fn real_worktrees_group_only_declared_projects_and_refresh_keeps_summary_snapshots() {
    use support::local_git::git;
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("application");
    std::fs::create_dir(&root).unwrap();
    git(&root, &["init", "-b", "main"]);
    git(&root, &["commit", "--allow-empty", "-m", "Fixture"]);
    git(
        &root,
        &["remote", "add", "origin", "git@github.com:acme/app.git"],
    );
    let linked = dir.path().join("linked");
    git(
        &root,
        &["worktree", "add", "-b", "review", linked.to_str().unwrap()],
    );
    let unused = dir.path().join("not-involved");
    git(
        &root,
        &["worktree", "add", "-b", "unused", unused.to_str().unwrap()],
    );
    let plain = dir.path().join("documents");
    std::fs::create_dir(&plain).unwrap();
    let (app, _, agent, board) = fixture(Arc::new(
        beeteam::repositories::local_git::LocalGitDiscovery::default(),
    ))
    .await;
    let mut request_body = body(&agent);
    request_body["workScope"] = json!({"projects":[{"key":"app","name":"Application","rootPath":root},{"key":"review","name":"Review","rootPath":linked},{"key":"docs","name":"Documents","rootPath":plain}]});
    let task = ok(
        &app,
        "POST",
        &format!("/api/v1/boards/{}/tasks", id(&board)),
        request_body.clone(),
        None,
    )
    .await;
    let scope = &task["workScope"];
    assert_eq!(scope["repositories"].as_array().unwrap().len(), 1);
    assert_eq!(
        scope["repositories"][0]["projectKeys"],
        json!(["app", "review"])
    );
    assert_eq!(scope["repositories"][0]["provider"], "github");
    assert_eq!(
        scope["repositories"][0]["webUrl"],
        "https://github.com/acme/app"
    );
    assert_eq!(scope["projects"][0]["discovery"]["isWorktree"], false);
    assert_eq!(scope["projects"][1]["discovery"]["isWorktree"], true);
    assert_eq!(scope["projects"][2]["discovery"]["status"], "not_git");
    assert!(!scope.to_string().contains("not-involved"));
    let path = format!("/api/v1/tasks/{}", id(&task));
    let summary_route = format!("{path}/execution-summaries");
    let execution = json!({"commitReport":{"hasCommits":true,"commits":[{"repositoryKey":scope["repositories"][0]["key"],"branch":scope["projects"][0]["discovery"]["branch"],"hash":scope["projects"][0]["discovery"]["headHash"],"availability":"local","remoteVerifiedAt":null,"commitUrl":null}]},"usageReport":session_usage(id(&agent)),"summary":"Fixture work","currentSummary":"Fixture complete","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&task),"originBoardId":id(&board)}});
    let result = ok(&app, "POST", &summary_route, execution, ver(&task)).await;
    git(
        &root,
        &[
            "remote",
            "set-url",
            "origin",
            "ssh://git@git.corp.example/acme/app.git",
        ],
    );
    let refreshed = ok(
        &app,
        "PATCH",
        &path,
        json!({"workScope":request_body["workScope"]}),
        ver(&result["task"]),
    )
    .await;
    assert_eq!(
        refreshed["workScope"]["repositories"][0]["key"],
        scope["repositories"][0]["key"]
    );
    assert_eq!(
        refreshed["workScope"]["repositories"][0]["provider"],
        "other"
    );
    assert!(refreshed["workScope"]["repositories"][0]["webUrl"].is_null());
    assert_eq!(
        get(&app, &summary_route).await["items"][0]["commitReport"],
        result["executionSummary"]["commitReport"]
    );
}
