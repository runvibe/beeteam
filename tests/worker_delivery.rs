use beeteam::{
    dto::session_delivery::SessionDestination,
    repositories::records::{Record, Records},
    services::leader_chat::worker_delivery::reserve,
};
use serde_json::json;
use uuid::Uuid;

fn fixture(with_chat: bool) -> (Records, Uuid, SessionDestination, Uuid, Uuid) {
    let mut r = Records::default();
    let leader = r.insert(Record::new(
        "agents",
        json!({"name":"Leader","slug":"leader"}),
    ));
    let worker = r.insert(Record::new(
        "agents",
        json!({"name":"Worker","slug":"worker"}),
    ));
    let team = r.insert(Record::new(
        "teams",
        json!({"leaderId":leader,"slug":"team"}),
    ));
    let board = r.insert(Record::new("boards", json!({"teamId":team})));
    let status = r.insert(Record::new("statuses", json!({"boardId":board})));
    let mut task_row = Record::new(
        "tasks",
        json!({"boardId":board,"statusId":status,"executorAgentId":worker,"authorAgentId":leader,"originBoardId":board,"slug":"task","currentSummary":"Testing","specification":""}),
    );
    task_row.data["rootTaskId"] = json!(task_row.id);
    let task = r.insert(task_row);
    let binding=r.insert(Record::new("agent_session_bindings",json!({"agentId":worker,"mode":"integrated","harness":"codex","installationId":"test","externalId":"worker-thread","projectRoot":"/tmp/project","endedAt":null})));
    if with_chat {
        let lb = r.insert(Record::new(
            "agent_session_bindings",
            json!({"agentId":leader,"mode":"integrated","endedAt":null}),
        ));
        r.insert(Record::new(
            "leader_chats",
            json!({"bindingId":lb,"leaderAgentId":leader,"teamId":team,"title":"Leader"}),
        ));
    }
    let comment = r.insert(Record::new(
        "comments",
        json!({"taskId":task,"body":"Inspect","actorId":leader}),
    ));
    let delivery=r.insert(Record::new("session_deliveries",json!({"taskId":task,"commentId":comment,"targetAgentId":worker,"bindingId":binding,"state":"dispatching"})));
    (
        r,
        delivery,
        SessionDestination {
            harness: "codex".into(),
            installation_id: "test".into(),
            external_id: "worker-thread".into(),
            project_root: "/tmp/project".into(),
        },
        worker,
        binding,
    )
}
#[test]
fn worker_turn_reserves_binding_and_keeps_origin_out_of_leader_active_turn() {
    let (mut r, id, target, worker, binding) = fixture(true);
    let turn = reserve(&mut r, id, &target).unwrap();
    assert_eq!(turn.reference("ownerAgentId"), Some(worker));
    assert_eq!(turn.reference("bindingId"), Some(binding));
    assert_eq!(turn.reference("sourceDeliveryId"), Some(id));
    let chat = r
        .get("leader_chats", turn.reference("chatId").unwrap())
        .unwrap();
    assert_ne!(chat.reference("bindingId"), Some(binding));
    assert_eq!(r.list("leader_chat_events").len(), 0);
    assert!(reserve(&mut r, id, &target).is_err());
}
#[test]
fn existing_human_turn_prevents_provider_dispatch_for_same_binding() {
    let (mut r, id, target, _, binding) = fixture(true);
    r.insert(Record::new(
        "leader_chat_turns",
        json!({"bindingId":binding,"status":"running"}),
    ));
    assert_eq!(
        reserve(&mut r, id, &target).unwrap_err().code,
        "session_busy"
    );
}
#[test]
fn external_or_replaced_binding_is_never_taken_over() {
    let (mut r, id, target, _, binding) = fixture(true);
    r.get_mut("agent_session_bindings", binding).unwrap().data["mode"] = json!("external");
    assert_eq!(
        reserve(&mut r, id, &target).unwrap_err().code,
        "external_mode"
    );
    r.get_mut("agent_session_bindings", binding).unwrap().data["mode"] = json!("integrated");
    r.get_mut("agent_session_bindings", binding).unwrap().data["externalId"] =
        json!("other-thread");
    assert_eq!(
        reserve(&mut r, id, &target).unwrap_err().code,
        "session_binding_conflict"
    );
}
#[test]
fn external_leader_has_no_fabricated_approval_chat() {
    let (mut r, id, target, _, _) = fixture(false);
    let turn = reserve(&mut r, id, &target).unwrap();
    assert!(turn.data["chatId"].is_null());
    assert!(r.list("leader_chats").is_empty());
}

use beeteam::{
    config::DatabaseDriver,
    dto::{
        backend::{Actor, Command},
        session_delivery::SessionEvent,
    },
    repositories::{
        contracts::{ResourceStore, SessionProvider},
        database::DatabaseRepository,
        integrated_provider::*,
    },
    services::leader_chat::{worker_delivery::WorkerDeliveryProvider, LeaderChatService},
};
use serde_json::Value;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::sync::mpsc;
struct ApprovalProvider(AtomicUsize);
impl IntegratedProvider for ApprovalProvider {
    fn create<'a>(&'a self, _: &'a str, _: &'a Value) -> ProviderFuture<'a, String> {
        Box::pin(async { Ok("unused".into()) })
    }
    fn inspect<'a>(&'a self, _: &'a SessionDestination, _: &'a Value) -> ProviderFuture<'a, Value> {
        Box::pin(async move {
            self.0.fetch_add(100, Ordering::SeqCst);
            Ok(json!({}))
        })
    }
    fn run<'a>(
        &'a self,
        _: &'a SessionDestination,
        text: &'a str,
        _: &'a Value,
        events: mpsc::Sender<IntegratedEvent>,
        mut controls: mpsc::Receiver<Control>,
    ) -> ProviderFuture<'a, ()> {
        Box::pin(async move {
            events
                .send(IntegratedEvent::Accepted("worker-provider-turn".into()))
                .await
                .unwrap();
            if text == "approval" {
                let approval_id = Uuid::now_v7();
                events
                    .send(IntegratedEvent::Approval {
                        approval_id,
                        kind: "command".into(),
                        title: "Run tests".into(),
                        description: "Worker asks permission".into(),
                        command: Some("cargo test".into()),
                        host: None,
                        paths: vec![],
                    })
                    .await
                    .unwrap();
                match controls.recv().await {
                    Some(Control::Decision {
                        approval_id: id,
                        accept: true,
                    }) => {
                        assert_eq!(id, approval_id);
                        self.0.fetch_add(1, Ordering::SeqCst);
                    }
                    _ => return Ok(()),
                }
            }
            events
                .send(IntegratedEvent::Text("Tests passed".into()))
                .await
                .unwrap();
            events.send(IntegratedEvent::Completed).await.unwrap();
            Ok(())
        })
    }
}
async fn stored(
    records: Records,
) -> (
    tempfile::TempDir,
    Arc<dyn ResourceStore>,
    LeaderChatService,
    Arc<ApprovalProvider>,
) {
    let dir = tempfile::tempdir().unwrap();
    let url = format!(
        "sqlite://{}",
        dir.path()
            .join("test.sql")
            .to_string_lossy()
            .replace('\\', "/")
    );
    let db = DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
        .await
        .unwrap();
    let (store, _) = db.stores();
    let mut u = store.begin().await.unwrap();
    for row in records.rows.into_values() {
        u.records.insert(row);
    }
    u.commit().await.unwrap();
    let provider = Arc::new(ApprovalProvider(AtomicUsize::new(0)));
    let service =
        LeaderChatService::new(store.clone()).with_provider(provider.clone(), "test".into());
    (dir, store, service, provider)
}
#[tokio::test]
async fn worker_approval_routes_to_leader_and_decision_reaches_only_origin_turn() {
    let (r, id, target, worker, binding) = fixture(true);
    let (_dir, store, service, provider) = stored(r).await;
    let bridge = WorkerDeliveryProvider::new(service.clone(), "http://localhost".into());
    let (tx, mut rx) = mpsc::channel(8);
    let run =
        tokio::spawn(async move { bridge.deliver_context(&target, "approval", tx, id).await });
    let approval = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        loop {
            let u = store.begin().await.unwrap();
            let row = u
                .records
                .list("leader_chat_approvals")
                .first()
                .map(|r| (*r).clone());
            u.rollback().await.unwrap();
            if let Some(row) = row {
                break row;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(approval.reference("agentId"), Some(worker));
    assert_eq!(approval.reference("bindingId"), Some(binding));
    let chat = approval.reference("chatId").unwrap();
    let turn = approval.reference("turnId").unwrap();
    let u = store.begin().await.unwrap();
    assert_ne!(
        u.records
            .get("leader_chats", chat)
            .unwrap()
            .reference("bindingId"),
        Some(binding)
    );
    assert!(!u
        .records
        .list("leader_chat_events")
        .iter()
        .any(|e| e.data["type"] == "turn.updated"));
    u.rollback().await.unwrap();
    service
        .write(Command {
            operation: "integrated:decision".into(),
            params: [
                ("chatId".into(), chat.to_string()),
                ("approvalId".into(), approval.id.to_string()),
            ]
            .into_iter()
            .collect(),
            query: Default::default(),
            body: json!({"decision":"accept"}),
            actor: Some(Actor {
                kind: "human".into(),
                id: None,
            }),
            expected_version: Some(approval.version),
            idempotency_key: Some(Uuid::now_v7()),
            upload: None,
        })
        .await
        .unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(10), run)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert_eq!(provider.0.load(Ordering::SeqCst), 1);
    let mut completed = false;
    while let Some(e) = rx.recv().await {
        if let SessionEvent::Completed { text, .. } = e {
            assert_eq!(text, "Tests passed");
            completed = true;
        }
    }
    assert!(completed);
    let u = store.begin().await.unwrap();
    assert_eq!(
        u.records.get("leader_chat_turns", turn).unwrap().data["status"],
        "completed"
    );
    assert!(u.records.list("leader_chat_messages").is_empty());
    u.rollback().await.unwrap();
}
#[tokio::test]
async fn missing_integrated_leader_never_auto_approves_worker() {
    let (r, id, target, _, _) = fixture(false);
    let (_dir, store, service, provider) = stored(r).await;
    let bridge = WorkerDeliveryProvider::new(service, "http://localhost".into());
    let (tx, _rx) = mpsc::channel(8);
    let error = bridge
        .deliver_context(&target, "approval", tx, id)
        .await
        .unwrap_err();
    assert_eq!(error.code, "approval_required");
    assert_eq!(provider.0.load(Ordering::SeqCst), 0);
    let u = store.begin().await.unwrap();
    assert!(u.records.list("leader_chat_approvals").is_empty());
    assert_eq!(
        u.records.list("leader_chat_turns")[0].data["status"],
        "uncertain"
    );
    u.rollback().await.unwrap();
}
#[tokio::test]
async fn leader_delivery_is_task_linked_system_notice_and_assistant_reply() {
    let (mut r, id, mut target, _, _) = fixture(true);
    let chat = r.list("leader_chats")[0].clone();
    let leader = chat.reference("leaderAgentId").unwrap();
    let binding = chat.reference("bindingId").unwrap();
    let b = r.get_mut("agent_session_bindings", binding).unwrap();
    b.data["harness"] = json!("codex");
    b.data["installationId"] = json!("test");
    b.data["externalId"] = json!("leader-thread");
    b.data["projectRoot"] = json!("/tmp/project");
    target.external_id = "leader-thread".into();
    let d = r.get_mut("session_deliveries", id).unwrap();
    d.data["targetAgentId"] = json!(leader);
    d.data["bindingId"] = json!(binding);
    let task = d.data["taskId"].clone();
    let (_dir, store, service, _) = stored(r).await;
    let bridge = WorkerDeliveryProvider::new(service, "http://localhost".into());
    let (tx, _rx) = mpsc::channel(8);
    bridge
        .deliver_context(&target, "normal", tx, id)
        .await
        .unwrap();
    let u = store.begin().await.unwrap();
    let messages = u.records.list("leader_chat_messages");
    assert_eq!(messages.len(), 2);
    assert!(messages
        .iter()
        .any(|m| m.data["role"] == "system" && m.data["taskId"] == task));
    assert!(messages
        .iter()
        .any(|m| m.data["role"] == "assistant" && m.data["content"] == "Tests passed"));
    assert!(!messages.iter().any(|m| m.data["role"] == "user"));
    u.rollback().await.unwrap();
}

#[tokio::test]
async fn runtime_external_binding_never_inspects_provider() {
    let (mut r, _, _, worker, binding) = fixture(true);
    r.get_mut("agent_session_bindings", binding).unwrap().data["mode"] = json!("external");
    let (_dir, _, service, provider) = stored(r).await;
    let mut cmd = beeteam::services::leader_chat::command("runtime");
    cmd.params.insert("agentId".into(), worker.to_string());
    let result = service.read(cmd).await.unwrap();
    assert_eq!(result["readiness"], "external");
    assert_eq!(result["capabilities"]["streaming"], false);
    assert_eq!(provider.0.load(Ordering::SeqCst), 0);
}
#[tokio::test]
async fn runtime_reports_binding_busy_from_conversation_delivery() {
    let (r, _, _, worker, _) = fixture(true);
    let (_dir, _, service, _) = stored(r).await;
    let mut cmd = beeteam::services::leader_chat::command("runtime");
    cmd.params.insert("agentId".into(), worker.to_string());
    let result = service.read(cmd).await.unwrap();
    assert_eq!(result["readiness"], "busy");
}

#[tokio::test]
async fn generic_rebind_and_archive_cannot_orphan_integrated_work() {
    let (mut r, _, _, worker, binding) = fixture(true);
    let status = r.list("statuses")[0].id;
    r.get_mut("statuses", status).unwrap().data["isDone"] = json!(true);
    let (_dir, store, _, _) = stored(r).await;
    let backend = beeteam::services::backend::service::BackendService::new(
        store.clone(),
        Arc::new(beeteam::repositories::local_git::LocalGitDiscovery::default()),
    );
    for (operation, body) in [
        (
            "claimAgentSession",
            json!({"expectedBindingId":binding,"session":{"mode":"external","harness":"codex","installationId":"test","externalId":"new-external","projectRoot":"/tmp/project"}}),
        ),
        ("archiveAgent", json!({"archived":true})),
    ] {
        let command = Command {
            operation: operation.into(),
            params: [("agentId".into(), worker.to_string())]
                .into_iter()
                .collect(),
            query: Default::default(),
            body,
            actor: Some(Actor {
                kind: "human".into(),
                id: None,
            }),
            expected_version: Some(1),
            idempotency_key: Some(Uuid::now_v7()),
            upload: None,
        };
        let error = backend.execute(command).await.unwrap_err();
        assert_eq!(error.code, "session_busy", "{error:?}");
    }
    let u = store.begin().await.unwrap();
    assert!(u
        .records
        .get("agent_session_bindings", binding)
        .unwrap()
        .data["endedAt"]
        .is_null());
    assert!(u
        .records
        .get("agents", worker)
        .unwrap()
        .archived_at
        .is_none());
    u.rollback().await.unwrap();
}
#[test]
fn uncertain_turn_blocks_binding_replacement_until_reconciled() {
    let (mut r, id, _, worker, binding) = fixture(true);
    r.get_mut("session_deliveries", id).unwrap().data["state"] = json!("completed");
    let turn = r.insert(Record::new(
        "leader_chat_turns",
        json!({"bindingId":binding,"status":"uncertain"}),
    ));
    assert_eq!(
        beeteam::services::leader_chat::rules::ensure_agent_idle(&r, worker)
            .unwrap_err()
            .code,
        "session_busy"
    );
    r.get_mut("leader_chat_turns", turn).unwrap().data["status"] = json!("completed");
    assert!(beeteam::services::leader_chat::rules::ensure_agent_idle(&r, worker).is_ok());
}
