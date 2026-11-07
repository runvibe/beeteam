mod support;
use axum::{body::Body, http::Request};
use beeteam::{
    config::DatabaseDriver,
    dto::session_delivery::*,
    repositories::{
        contracts::{ResourceStore, SessionProvider},
        database::DatabaseRepository,
    },
    services::managed_sessions::dispatch::ManagedSessionService,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::{
    future::Future,
    pin::Pin,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
};
use support::*;
use tokio::sync::mpsc;
use tower::ServiceExt;
struct Provider {
    calls: AtomicUsize,
    fail: bool,
}
impl SessionProvider for Provider {
    fn deliver<'a>(
        &'a self,
        _: &'a SessionDestination,
        _: &'a str,
        events: mpsc::Sender<SessionEvent>,
    ) -> Pin<Box<dyn Future<Output = Result<(), SessionFailure>> + Send + 'a>> {
        Box::pin(async move {
            self.calls.fetch_add(1, Ordering::SeqCst);
            events
                .send(SessionEvent::Accepted {
                    turn_id: "owned-turn".into(),
                })
                .await
                .unwrap();
            if self.fail {
                return Err(SessionFailure::new(
                    "connection_lost",
                    "Synthetic isolated failure",
                    true,
                ));
            }
            events
                .send(SessionEvent::Completed {
                    turn_id: "owned-turn".into(),
                    text: "Reply for original Conversation".into(),
                })
                .await
                .unwrap();
            Ok(())
        })
    }
}
async fn fixture() -> (axum::Router, Arc<dyn ResourceStore>, Value, Value) {
    let (app, store) = if std::env::var("BEE_TEST_DRIVER").as_deref() == Ok("sqlite") {
        let (app, pool) = sqlite_app_with_pool().await;
        let url = format!(
            "sqlite://{}",
            pool.connect_options()
                .get_filename()
                .to_string_lossy()
                .replace('\\', "/")
        );
        let db = DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
            .await
            .unwrap();
        (app, db.stores().0)
    } else {
        let (app, pool) = app_with_pool().await;
        (app, DatabaseRepository::new(pool).stores().0)
    };
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Isolated leader"}),
        None,
    )
    .await;
    let worker=ok(&app,"POST","/api/v2/agents/with-session",json!({"agent":{"name":"Isolated worker"},"session":{"harness":"codex","installationId":"isolated","externalId":"owned","projectRoot":"/tmp/isolated"}}),None).await["agent"].clone();
    let team=ok(&app,"POST","/api/v2/teams",json!({"name":"Isolated team","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}),None).await;
    let board = ok(
        &app,
        "POST",
        "/api/v2/boards",
        json!({"name":"Isolated board","teamId":id(&team)}),
        None,
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v2/boards/{}/tasks",id(&board)),json!({"title":"Delivery acceptance","authorAgentId":id(&leader),"executorAgentId":id(&worker),"workScope":test_project_scope(),"coordinationContext":manual()}),None).await;
    (app, store, task, worker)
}
#[tokio::test]
async fn replay_creates_one_delivery_and_a_correlated_reply_is_persisted_once() {
    let (app, store, task, worker) = fixture().await;
    let route = format!("/api/v2/tasks/{}/comments", id(&task));
    let key = uuid::Uuid::new_v4();
    let body = json!({"body":"Please inspect","mentionedAgentIds":[id(&worker)]});
    let first = request_key(&app, "POST", &route, body.clone(), ver(&task), key).await;
    assert_eq!(first.0, 201, "{}", first.1);
    assert_eq!(
        request_key(&app, "POST", &route, body, ver(&task), key).await,
        first
    );
    let provider = Arc::new(Provider {
        calls: AtomicUsize::new(0),
        fail: false,
    });
    let service = ManagedSessionService::new(store, provider.clone(), "isolated".into());
    assert!(service.deliver_next().await.unwrap());
    assert!(!service.deliver_next().await.unwrap());
    let rows = get(
        &app,
        &format!("/api/v2/tasks/{}/session-deliveries", id(&task)),
    )
    .await;
    assert_eq!(rows["total"], 1);
    assert_eq!(rows["items"][0]["state"], "completed");
    assert_eq!(provider.calls.load(Ordering::SeqCst), 1);
    let replies = get(&app, &route).await;
    assert_eq!(replies["total"], 2);
    assert!(replies["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r["inReplyToCommentId"] == first.1["id"]));
}
#[tokio::test]
async fn uncertain_send_and_restart_never_resubmit_the_request() {
    let (app, store, task, worker) = fixture().await;
    ok(
        &app,
        "POST",
        &format!("/api/v2/tasks/{}/comments", id(&task)),
        json!({"body":"one","mentionedAgentIds":[id(&worker)]}),
        ver(&task),
    )
    .await;
    let provider = Arc::new(Provider {
        calls: AtomicUsize::new(0),
        fail: true,
    });
    let service = ManagedSessionService::new(store.clone(), provider.clone(), "isolated".into());
    assert!(service.deliver_next().await.unwrap());
    let restarted = ManagedSessionService::new(store, provider.clone(), "isolated".into());
    restarted.recover().await.unwrap();
    assert!(!restarted.deliver_next().await.unwrap());
    let rows = get(
        &app,
        &format!("/api/v2/tasks/{}/session-deliveries", id(&task)),
    )
    .await;
    assert_eq!(rows["items"][0]["state"], "uncertain");
    assert_eq!(rows["items"][0]["turnId"], "owned-turn");
    assert_eq!(provider.calls.load(Ordering::SeqCst), 1);
}

async fn rpc(app: &axum::Router, name: &str, args: Value) -> Value {
    let response=app.clone().oneshot(Request::post("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).to_string())).unwrap()).await.unwrap();
    let value: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(value["result"]["isError"], false, "{value}");
    value["result"]["structuredContent"]["data"].clone()
}
#[tokio::test]
async fn worker_summary_notices_are_atomic_with_compound_replays_and_leader_suppression() {
    let (app, _store, task, worker) = fixture().await;
    let key = uuid::Uuid::new_v4();
    let mut usage = session_usage(id(&worker));
    usage["entries"][0]["actorRole"] = json!("worker");
    let body = json!({"currentSummary":"Isolated worker checkpoint","summary":"Synthetic isolated transport test","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"commitReport":{"hasCommits":false,"commits":[]},"usageReport":usage,"executionContext":{"rootTaskId":id(&task),"originBoardId":task["boardId"]}});
    let args = json!({"taskId":id(&task),"expectedVersion":ver(&task),"actor":{"kind":"agent","id":id(&worker)},"idempotencyKey":key,"execution":body});
    let first = rpc(&app, "close_activity", args.clone()).await;
    assert_eq!(rpc(&app, "close_activity", args).await, first);
    let comments = format!("/api/v2/tasks/{}/comments", id(&task));
    assert_eq!(get(&app, &comments).await["total"], 1);
    let deliveries = format!("/api/v2/tasks/{}/session-deliveries", id(&task));
    assert_eq!(get(&app, &deliveries).await["total"], 1);
    let fresh = get(&app, &format!("/api/v2/tasks/{}", id(&task))).await;
    let leader = task["authorAgentId"].as_str().unwrap();
    let mut leader_body = body.clone();
    leader_body["usageReport"] = session_usage(leader);
    leader_body["usageReport"]["entries"][0]["actorRole"] = json!("leader");
    rpc(&app,"createExecutionSummary",json!({"params":{"taskId":id(&task)},"expectedVersion":ver(&fresh),"actor":{"kind":"agent","id":leader},"idempotencyKey":uuid::Uuid::new_v4(),"body":leader_body})).await;
    assert_eq!(get(&app, &comments).await["total"], 1);
    assert_eq!(get(&app, &deliveries).await["total"], 1);
    let fresh = get(&app, &format!("/api/v2/tasks/{}", id(&task))).await;
    let mut second = body.clone();
    second["usageReport"] = session_usage(id(&worker));
    second["usageReport"]["entries"][0]["actorRole"] = json!("worker");
    let done = get(
        &app,
        &format!(
            "/api/v2/boards/{}/statuses?isDone=true",
            task["boardId"].as_str().unwrap()
        ),
    )
    .await["items"][0]["id"]
        .clone();
    second["statusId"] = done;
    second["outcome"] = json!("completed");
    rpc(&app,"createExecutionSummary",json!({"params":{"taskId":id(&task)},"expectedVersion":ver(&fresh),"actor":{"kind":"agent","id":id(&worker)},"idempotencyKey":uuid::Uuid::new_v4(),"body":second})).await;
    assert_eq!(get(&app, &comments).await["total"], 2);
    assert_eq!(get(&app, &deliveries).await["total"], 2);
}

#[tokio::test]
async fn rollback_and_cold_recovery_do_not_send_or_duplicate_comments() {
    let (app, store, task, worker) = fixture().await;
    let stranger = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Not on team"}),
        None,
    )
    .await;
    let comments = format!("/api/v2/tasks/{}/comments", id(&task));
    assert_eq!(
        request(
            &app,
            "POST",
            &comments,
            json!({"body":"must roll back","mentionedAgentIds":[id(&stranger)]}),
            ver(&task)
        )
        .await
        .0,
        400
    );
    assert_eq!(get(&app, &comments).await["total"], 0);
    ok(
        &app,
        "POST",
        &comments,
        json!({"body":"owned","mentionedAgentIds":[id(&worker)]}),
        ver(&task),
    )
    .await;
    let deliveries = format!("/api/v2/tasks/{}/session-deliveries", id(&task));
    let row = get(&app, &deliveries).await["items"][0].clone();
    let mut unit = store.begin().await.unwrap();
    let record = unit
        .records
        .get_mut(
            "session_deliveries",
            uuid::Uuid::parse_str(id(&row)).unwrap(),
        )
        .unwrap();
    record.data["state"] = json!("dispatching");
    record.touch();
    unit.commit().await.unwrap();
    let provider = Arc::new(Provider {
        calls: AtomicUsize::new(0),
        fail: false,
    });
    let service = ManagedSessionService::new(store, provider.clone(), "isolated".into());
    service.recover().await.unwrap();
    assert!(!service.deliver_next().await.unwrap());
    assert_eq!(provider.calls.load(Ordering::SeqCst), 0);
    assert_eq!(
        get(&app, &deliveries).await["items"][0]["state"],
        "uncertain"
    );
}

#[tokio::test]
async fn a_blocked_binding_cannot_starve_other_sessions_beyond_the_first_page() {
    use beeteam::{repositories::records::Record, services::managed_sessions::queue};
    let (app, store, task, worker) = fixture().await;
    let other=ok(&app,"POST","/api/v2/agents/with-session",json!({"agent":{"name":"Other isolated worker"},"session":{"harness":"codex","installationId":"isolated","externalId":"other-owned","projectRoot":"/tmp/isolated"}}),None).await["agent"].clone();
    let tid = uuid::Uuid::parse_str(id(&task)).unwrap();
    let wid = uuid::Uuid::parse_str(id(&worker)).unwrap();
    let oid = uuid::Uuid::parse_str(id(&other)).unwrap();
    let mut unit = store.begin().await.unwrap();
    let board = unit
        .records
        .get("tasks", tid)
        .unwrap()
        .reference("boardId")
        .unwrap();
    let team = unit
        .records
        .get("boards", board)
        .unwrap()
        .reference("teamId")
        .unwrap();
    unit.records.insert(Record::new(
        "memberships",
        json!({"teamId":team,"agentId":oid}),
    ));
    for index in 0..102 {
        let cid=unit.records.insert(Record::new("comments",json!({"taskId":tid,"body":format!("Owned request {index}"),"actorId":null,"actorKind":"human"})));
        queue::comment(
            &mut unit.records,
            tid,
            cid,
            &[if index == 101 { oid } else { wid }],
        )
        .unwrap();
        if index == 0 {
            let id = unit.records.list("session_deliveries")[0].id;
            unit.records.get_mut("session_deliveries", id).unwrap().data["state"] =
                json!("uncertain");
        }
    }
    unit.commit().await.unwrap();
    let provider = Arc::new(Provider {
        calls: AtomicUsize::new(0),
        fail: false,
    });
    let service = ManagedSessionService::new(store, provider.clone(), "isolated".into());
    assert!(service.deliver_next().await.unwrap());
    assert_eq!(provider.calls.load(Ordering::SeqCst), 1);
}
