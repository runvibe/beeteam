use beeteam::{
    repositories::records::{Record, Records},
    services::managed_sessions::queue,
};
use serde_json::json;
use uuid::Uuid;
fn add(r: &mut Records, t: &'static str, v: serde_json::Value) -> Uuid {
    r.insert(Record::new(t, v))
}
fn fixture() -> (Records, Uuid, Uuid, Uuid, Uuid) {
    let mut r = Records::default();
    let leader = add(&mut r, "agents", json!({"name":"leader"}));
    let worker = add(&mut r, "agents", json!({"name":"worker"}));
    let team = add(&mut r, "teams", json!({"leaderId":leader}));
    add(
        &mut r,
        "memberships",
        json!({"teamId":team,"agentId":worker}),
    );
    let board = add(&mut r, "boards", json!({"teamId":team}));
    let task = add(&mut r, "tasks", json!({"boardId":board}));
    (r, task, leader, worker, team)
}
#[test]
fn worker_summaries_notify_once_but_leader_summaries_never_notify() {
    let (mut r, task, leader, worker, _) = fixture();
    add(
        &mut r,
        "agent_session_bindings",
        json!({"agentId":worker,"harness":"codex","installationId":"local","externalId":"owned","projectRoot":"/tmp","endedAt":null}),
    );
    let summary = add(
        &mut r,
        "execution_summaries",
        json!({"taskId":task,"actorId":worker,"actorKind":"agent","summary":"worker update"}),
    );
    queue::summary(&mut r, task, summary).unwrap();
    queue::summary(&mut r, task, summary).unwrap();
    assert_eq!(r.list("session_deliveries").len(), 1);
    assert_eq!(r.list("comments").len(), 1);
    assert_eq!(
        r.list("session_deliveries")[0].reference("targetAgentId"),
        Some(leader)
    );
    let own = add(
        &mut r,
        "execution_summaries",
        json!({"taskId":task,"actorId":leader,"actorKind":"agent","summary":"leader update"}),
    );
    queue::summary(&mut r, task, own).unwrap();
    assert_eq!(r.list("session_deliveries").len(), 1);
}
#[test]
fn unmanaged_worker_summaries_do_not_create_notices_or_future_delivery_backlogs() {
    let (mut r, task, _, worker, _) = fixture();
    let summary = add(
        &mut r,
        "execution_summaries",
        json!({"taskId":task,"actorId":worker,"actorKind":"agent","summary":"Legacy skills workflow"}),
    );
    queue::summary(&mut r, task, summary).unwrap();
    assert!(r.list("comments").is_empty());
    assert!(r.list("session_deliveries").is_empty());
}
#[test]
fn mentions_are_deduplicated_and_unbound_recipients_stay_pending() {
    let (mut r, task, leader, worker, _) = fixture();
    let comment = add(
        &mut r,
        "comments",
        json!({"taskId":task,"actorId":leader,"actorKind":"agent","body":"Please inspect"}),
    );
    queue::comment(&mut r, task, comment, &[worker, worker]).unwrap();
    queue::comment(&mut r, task, comment, &[worker]).unwrap();
    let rows = r.list("session_deliveries");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].data["state"], "waiting_binding");
}
#[test]
fn recipients_must_belong_to_the_tasks_team() {
    let (mut r, task, leader, _, _) = fixture();
    let stranger = add(&mut r, "agents", json!({"name":"other team"}));
    let comment = add(
        &mut r,
        "comments",
        json!({"taskId":task,"actorId":leader,"body":"Hello"}),
    );
    assert!(queue::comment(&mut r, task, comment, &[stranger]).is_err());
    assert!(r.list("session_deliveries").is_empty());
}
#[test]
fn an_explicit_binding_unblocks_pending_but_replacement_never_reroutes_queued_work() {
    let (mut r, task, leader, worker, _) = fixture();
    let comment = add(
        &mut r,
        "comments",
        json!({"taskId":task,"actorId":leader,"body":"Hello"}),
    );
    queue::comment(&mut r, task, comment, &[worker]).unwrap();
    let delivery = r.list("session_deliveries")[0].id;
    assert!(!queue::claim(&mut r, delivery, "local").unwrap());
    let binding = add(
        &mut r,
        "agent_session_bindings",
        json!({"agentId":worker,"harness":"codex","installationId":"local","externalId":"owned","projectRoot":"/tmp","endedAt":null}),
    );
    assert!(queue::claim(&mut r, delivery, "local").unwrap());
    assert!(!queue::claim(&mut r, delivery, "local").unwrap());
    r.get_mut("session_deliveries", delivery).unwrap().data["state"] = json!("pending");
    r.get_mut("agent_session_bindings", binding).unwrap().data["endedAt"] = json!("ended");
    add(
        &mut r,
        "agent_session_bindings",
        json!({"agentId":worker,"harness":"codex","installationId":"local","externalId":"new","projectRoot":"/tmp","endedAt":null}),
    );
    assert!(!queue::claim(&mut r, delivery, "local").unwrap());
    assert_eq!(
        r.get("session_deliveries", delivery).unwrap().data["state"],
        "superseded"
    );
}
#[test]
fn archived_tasks_never_dispatch_queued_mentions() {
    let (mut r, task, leader, worker, _) = fixture();
    add(
        &mut r,
        "agent_session_bindings",
        json!({"agentId":worker,"harness":"codex","installationId":"local","externalId":"owned","projectRoot":"/tmp","endedAt":null}),
    );
    let comment = add(
        &mut r,
        "comments",
        json!({"taskId":task,"actorId":leader,"body":"Hello"}),
    );
    queue::comment(&mut r, task, comment, &[worker]).unwrap();
    let delivery = r.list("session_deliveries")[0].id;
    r.get_mut("tasks", task).unwrap().archived_at = Some(chrono::Utc::now());
    assert!(!queue::claim(&mut r, delivery, "local").unwrap());
}
