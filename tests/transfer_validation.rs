use beeteam::{
    repositories::transfer::archive::{ArchiveStore, Limits},
    services::data_transfer::validation::inspect,
};
use serde_json::{json, Value};
use uuid::Uuid;
fn row(id: Uuid, data: Value) -> Value {
    json!({"id":id,"data":data,"version":1,"createdAt":"2026-10-28T00:00:00Z","updatedAt":"2026-10-28T00:00:00Z","archivedAt":null,"deletedAt":null})
}
fn validate(rows: Vec<(&str, Value)>) -> String {
    let dir = tempfile::tempdir().unwrap();
    let store = ArchiveStore::new(dir.path().into(), Limits::default()).unwrap();
    let id = Uuid::now_v7();
    store.create_stage(id).unwrap();
    for (group, row) in rows {
        store
            .append(id, &format!("records/{group}.jsonl"), &row)
            .unwrap();
    }
    let manifest = store.seal(id, "sqlite", 0).unwrap();
    store.validate_archive(id).unwrap();
    inspect(&store, id, &manifest, "sqlite")
        .unwrap_err()
        .to_string()
}
#[test]
fn rejects_orphans_slug_collisions_and_role_conflicts() {
    let agent = Uuid::now_v7();
    let team = Uuid::now_v7();
    let a = row(agent, json!({"slug":"agent"}));
    let t = row(team, json!({"slug":"team","leaderId":agent}));
    assert!(validate(vec![("teams", t.clone())]).contains("orphan_reference"));
    assert!(validate(vec![
        ("agents", a.clone()),
        ("agents", row(Uuid::now_v7(), json!({"slug":"agent"})))
    ])
    .contains("duplicate_slug"));
    assert!(validate(vec![
        ("agents", a),
        ("teams", t),
        (
            "memberships",
            row(Uuid::now_v7(), json!({"teamId":team,"agentId":agent}))
        )
    ])
    .contains("role_conflict"));
}
#[test]
fn rejects_task_cycles_before_restore() {
    let agent = Uuid::now_v7();
    let team = Uuid::now_v7();
    let board = Uuid::now_v7();
    let status = Uuid::now_v7();
    let a = Uuid::now_v7();
    let b = Uuid::now_v7();
    let task = |id, parent, slug| {
        row(
            id,
            json!({"slug":slug,"boardId":board,"statusId":status,"parentId":parent,"rootTaskId":a,"originBoardId":board,"authorAgentId":agent,"executorAgentId":agent,"specification":"","currentSummary":""}),
        )
    };
    assert!(validate(vec![
        ("agents", row(agent, json!({"slug":"agent"}))),
        ("teams", row(team, json!({"slug":"team","leaderId":agent}))),
        ("boards", row(board, json!({"teamId":team}))),
        ("statuses", row(status, json!({"boardId":board}))),
        ("tasks", task(a, b, "a")),
        ("tasks", task(b, a, "b"))
    ])
    .contains("parent_cycle"));
}
