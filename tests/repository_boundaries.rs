mod support;
use serde_json::json;
use std::time::Duration;

#[tokio::test]
async fn reads_do_not_wait_for_the_mutation_lock() {
    let (app, pool) = support::app_with_pool().await;
    support::ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Visible"}),
        None,
    )
    .await;
    let mut writer = pool.begin().await.unwrap();
    sqlx::query("SELECT pg_advisory_xact_lock(1884347301)")
        .execute(&mut *writer)
        .await
        .unwrap();
    let result = tokio::time::timeout(
        Duration::from_secs(2),
        support::request(
            &app,
            "GET",
            "/api/v1/agents?limit=1&offset=0",
            json!(null),
            None,
        ),
    )
    .await;
    writer.rollback().await.unwrap();
    let (status, data) = result.expect("reads must not wait for the write transaction");
    assert_eq!(status, 200);
    assert_eq!(data["total"], 1);
    assert_eq!(data["items"][0]["name"], "Visible");
}

#[test]
fn transport_and_dto_do_not_depend_on_postgres() {
    for (file, source) in [
        ("HTTP", include_str!("../src/routes/backend.rs")),
        ("MCP", include_str!("../src/routes/mcp_adapter.rs")),
        ("DTO", include_str!("../src/dto/backend.rs")),
        ("errors", include_str!("../src/error.rs")),
        (
            "backend service",
            include_str!("../src/services/backend/mod.rs"),
        ),
        (
            "compound service",
            include_str!("../src/services/backend/composite.rs"),
        ),
        ("change feed", include_str!("../src/services/changes.rs")),
    ] {
        for forbidden in [
            "sqlx::",
            "ResourceRepository",
            "repositories::resources",
            "repositories::changes",
            ".pool()",
        ] {
            assert!(
                !source.contains(forbidden),
                "{file} exposes storage detail {forbidden}"
            );
        }
    }
}

fn agent_list() -> beeteam::dto::backend::Command {
    beeteam::dto::backend::Command {
        operation: "listAgents".into(),
        params: Default::default(),
        query: Default::default(),
        body: json!(null),
        actor: None,
        expected_version: None,
        idempotency_key: None,
        upload: None,
    }
}

#[tokio::test]
async fn read_snapshot_is_stable_and_cannot_commit_changes() {
    use beeteam::repositories::{contracts::ResourceStore, resources::ResourceRepository};
    let (app, pool) = support::app_with_pool().await;
    let first = support::ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Before"}),
        None,
    )
    .await;
    let repository = ResourceRepository::new(pool);
    let command = agent_list();
    let mut snapshot = repository.read(&command).await.unwrap();
    assert_eq!(snapshot.select(&command).await.unwrap().total, 1);
    support::ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"After"}),
        None,
    )
    .await;
    assert_eq!(snapshot.select(&command).await.unwrap().total, 1);
    snapshot.commit().await.unwrap();
    let mut new_snapshot = repository.read(&command).await.unwrap();
    assert_eq!(new_snapshot.select(&command).await.unwrap().total, 2);
    let id = uuid::Uuid::parse_str(support::id(&first)).unwrap();
    new_snapshot.records.get_mut("agents", id).unwrap().data["name"] = json!("Must not persist");
    assert!(new_snapshot.commit().await.is_err());
    assert_eq!(
        support::get(&app, &format!("/api/v1/agents/{id}")).await["name"],
        "Before"
    );
}

#[tokio::test]
async fn pagination_keeps_counts_literal_search_and_empty_pages() {
    let app = support::app().await;
    for name in ["Same", "Same", "100%_literal", "Beta"] {
        support::ok(&app, "POST", "/api/v1/agents", json!({"name":name}), None).await;
    }
    let first = support::get(&app, "/api/v1/agents?name=Same&sortBy=name&limit=1").await;
    let second = support::get(
        &app,
        "/api/v1/agents?name=Same&sortBy=name&limit=1&offset=1",
    )
    .await;
    assert_eq!(first["total"], 2);
    assert_ne!(first["items"][0]["id"], second["items"][0]["id"]);
    assert_eq!(first["nextOffset"], 1);
    assert_eq!(second["hasMore"], false);
    let empty = support::get(&app, "/api/v1/agents?offset=100&limit=1").await;
    assert_eq!(empty["total"], 4);
    assert_eq!(empty["items"], json!([]));
    assert_eq!(empty["nextOffset"], json!(null));
    let literal = support::get(&app, "/api/v1/agents?name=%25_").await;
    assert_eq!(literal["total"], 1);
    assert_eq!(literal["items"][0]["name"], "100%_literal");
    let bounded = support::get(&app, "/api/v1/agents?createdFrom=2000-01-01T00%3A00%3A00Z&createdBefore=2100-01-01T00%3A00%3A00Z").await;
    assert_eq!(bounded["total"], 4);
}

#[tokio::test]
async fn agent_listing_does_not_read_unrelated_task_tables() {
    let (app, pool) = support::app_with_pool().await;
    for name in ["Alpha", "Alpha 2", "Beta"] {
        support::ok(&app, "POST", "/api/v1/agents", json!({"name":name}), None).await;
    }
    let mut lock = pool.begin().await.unwrap();
    sqlx::query("LOCK TABLE tasks IN ACCESS EXCLUSIVE MODE")
        .execute(&mut *lock)
        .await
        .unwrap();
    let result = tokio::time::timeout(
        Duration::from_secs(2),
        support::request(
            &app,
            "GET",
            "/api/v1/agents?name=alpha&sortBy=name&offset=1&limit=1",
            json!(null),
            None,
        ),
    )
    .await;
    lock.rollback().await.unwrap();
    let (status, data) = result.expect("agent listing must not access unrelated tasks");
    assert_eq!(status, 200);
    assert_eq!(data["total"], 2);
    assert_eq!(data["items"][0]["name"], "Alpha 2");
    assert_eq!(data["hasMore"], false);
}
