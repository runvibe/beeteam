use beeteam::{
    dto::backend::{Command, Outcome},
    repositories::{
        contracts::{ChangeSource, ResourceStore},
        records::Record,
        sqlite::{self, ResourceRepository},
    },
};
use serde_json::json;
use std::{path::PathBuf, time::Duration};
use uuid::Uuid;
fn url() -> (String, PathBuf) {
    let path = std::env::temp_dir().join(format!("bee-sqlite-{}.db", Uuid::new_v4()));
    (
        format!("sqlite://{}", path.to_string_lossy().replace('\\', "/")),
        path,
    )
}
fn command() -> Command {
    Command {
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
async fn add(repo: &ResourceRepository, name: &str) -> Uuid {
    let mut unit = repo.begin().await.unwrap();
    let slug = unit.allocate_slug("agents", name).await.unwrap();
    let id = unit
        .records
        .insert(Record::new("agents", json!({"name":name,"slug":slug})));
    unit.commit().await.unwrap();
    id
}
#[tokio::test]
async fn persistence_replay_file_lifecycle_and_slug_reservations_survive_reopen() {
    let (url, path) = url();
    let pool = sqlite::connect(&url).await.unwrap();
    let repo = ResourceRepository::new(pool.clone());
    let id = add(&repo, "D\u{00e9}j\u{00e0} Vu").await;
    assert_eq!(repo.resolve_slug("agents", "deja-vu").await.unwrap().0, id);
    let mut unit = repo.begin().await.unwrap();
    let file = unit.put_file(b"persisted").await.unwrap();
    let key = Uuid::new_v4();
    unit.save_replay(
        "human:",
        "createAgent",
        key,
        "hash",
        &Outcome::data(json!({"legacy":true})),
    )
    .await
    .unwrap();
    unit.records.get_mut("agents", id).unwrap().deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    drop(repo);
    pool.close().await;
    let pool = sqlite::connect(&url).await.unwrap();
    let repo = ResourceRepository::new(pool.clone());
    assert!(repo.resolve_slug("agents", "deja-vu").await.is_err());
    let mut unit = repo.begin().await.unwrap();
    assert_eq!(
        unit.allocate_slug("agents", "D\u{00e9}j\u{00e0} Vu")
            .await
            .unwrap(),
        "deja-vu-2"
    );
    assert_eq!(unit.file(file).await.unwrap(), b"persisted");
    assert_eq!(
        unit.replay("human:", "createAgent", key, "hash")
            .await
            .unwrap()
            .unwrap()
            .data,
        json!({"legacy":true})
    );
    assert_eq!(
        unit.replay("human:", "createAgent", key, "different")
            .await
            .unwrap_err()
            .code,
        "idempotency_conflict"
    );
    unit.delete_file(file).await.unwrap();
    unit.commit().await.unwrap();
    assert!(repo.begin().await.unwrap().file(file).await.is_err());
    drop(repo);
    pool.close().await;
    std::fs::remove_file(path).unwrap();
}
#[tokio::test]
async fn independent_writers_serialize_without_lost_updates_or_slug_reuse() {
    let (url, path) = url();
    let first = sqlite::connect(&url).await.unwrap();
    let second = sqlite::connect(&url).await.unwrap();
    let a = ResourceRepository::new(first.clone());
    let b = ResourceRepository::new(second.clone());
    let (a, b) = tokio::join!(add(&a, "Duplicate"), add(&b, "Duplicate"));
    assert_ne!(a, b);
    let names: Vec<String> = sqlx::query_scalar("SELECT slug FROM agents ORDER BY slug")
        .fetch_all(&first)
        .await
        .unwrap();
    assert_eq!(names, vec!["duplicate", "duplicate-2"]);
    first.close().await;
    second.close().await;
    std::fs::remove_file(path).unwrap();
}
#[tokio::test]
async fn wal_reads_are_stable_bounded_and_reject_every_write_path() {
    let (url, path) = url();
    let pool = sqlite::connect(&url).await.unwrap();
    let repo = ResourceRepository::new(pool.clone());
    add(&repo, "Before").await;
    let c = command();
    let mut read = repo.read(&c).await.unwrap();
    assert_eq!(read.select(&c).await.unwrap().total, 1);
    let mut write = repo.begin().await.unwrap();
    write.records.insert(Record::new(
        "agents",
        json!({"name":"After","slug":"after"}),
    ));
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(1), read.select(&c))
            .await
            .unwrap()
            .unwrap()
            .total,
        1
    );
    write.commit().await.unwrap();
    assert_eq!(read.select(&c).await.unwrap().total, 1);
    assert!(read.put_file(b"forbidden").await.is_err());
    assert!(read.delete_file(Uuid::now_v7()).await.is_err());
    assert!(read.sequence().await.is_err());
    assert!(read.allocate_slug("agents", "bad").await.is_err());
    assert!(read
        .replay("human:", "op", Uuid::new_v4(), "h")
        .await
        .is_err());
    assert!(read
        .save_replay(
            "human:",
            "op",
            Uuid::new_v4(),
            "h",
            &Outcome::data(json!(null))
        )
        .await
        .is_err());
    read.commit().await.unwrap();
    let mut read = repo.read(&c).await.unwrap();
    assert_eq!(read.select(&c).await.unwrap().total, 2);
    drop(read);
    drop(repo);
    pool.close().await;
    std::fs::remove_file(path).unwrap();
}
#[tokio::test]
async fn cross_connection_clock_observes_only_committed_record_changes() {
    let (url, path) = url();
    let pool = sqlite::connect(&url).await.unwrap();
    let other = sqlite::connect(&url).await.unwrap();
    let source = sqlite::changes::ChangeRepository::new(pool.clone());
    let mut stream = source.connect().await.unwrap();
    let repo = ResourceRepository::new(other.clone());
    {
        let mut unit = repo.begin().await.unwrap();
        unit.records
            .insert(Record::new("agents", json!({"slug":"rolled-back"})));
    }
    assert!(
        tokio::time::timeout(Duration::from_millis(250), stream.next())
            .await
            .is_err()
    );
    add(&repo, "Committed").await;
    assert!(tokio::time::timeout(Duration::from_secs(2), stream.next())
        .await
        .unwrap()
        .unwrap());
    repo.begin().await.unwrap().commit().await.unwrap();
    assert!(
        tokio::time::timeout(Duration::from_millis(250), stream.next())
            .await
            .is_err()
    );
    drop(stream);
    drop(repo);
    pool.close().await;
    other.close().await;
    std::fs::remove_file(path).unwrap();
}
#[tokio::test]
async fn schema_rejects_invalid_ids_relationships_immutable_slugs_and_physical_deletion() {
    let (url, path) = url();
    let pool = sqlite::connect(&url).await.unwrap();
    let repo = ResourceRepository::new(pool.clone());
    let id = add(&repo, "Kept").await;
    for bad in [
        Uuid::new_v4().to_string(),
        "00000000-0000-7000-c000-000000000000".into(),
        "zzzzzzzz-zzzz-7zzz-8zzz-zzzzzzzzzzzz".into(),
    ] {
        assert!(sqlx::query("INSERT INTO agents(id,data,created_at,updated_at) VALUES($1,'{\"slug\":\"bad\"}','2026-01-01','2026-01-01')").bind(bad).execute(&pool).await.is_err());
    }
    assert!(
        sqlx::query("UPDATE agents SET data=json_set(data,'$.slug','replaced') WHERE id=$1")
            .bind(id.to_string())
            .execute(&pool)
            .await
            .is_err()
    );
    assert!(sqlx::query("DELETE FROM agents WHERE id=$1")
        .bind(id.to_string())
        .execute(&pool)
        .await
        .is_err());
    let mut unit = repo.begin().await.unwrap();
    unit.records
        .insert(Record::new("boards", json!({"teamId":Uuid::now_v7()})));
    assert_eq!(
        unit.commit().await.unwrap_err().code,
        "usage_policy_conflict"
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM boards")
            .fetch_one(&pool)
            .await
            .unwrap(),
        0
    );
    drop(repo);
    pool.close().await;
    std::fs::remove_file(path).unwrap();
}

#[tokio::test]
async fn sql_filtering_is_unicode_literal_and_timezone_aware_with_stable_pages() {
    let (url, path) = url();
    let pool = sqlite::connect(&url).await.unwrap();
    let repo = ResourceRepository::new(pool.clone());
    for name in ["\u{00c9}cole_100%", "\u{00e9}COLE other", "Unrelated"] {
        add(&repo, name).await;
    }
    let mut c = command();
    c.query.insert("name".into(), json!("\u{00e9}cole"));
    c.query.insert("limit".into(), json!(1));
    c.query.insert("sortBy".into(), json!("name"));
    c.query
        .insert("createdFrom".into(), json!("2000-01-01T03:00:00+03:00"));
    c.query
        .insert("createdBefore".into(), json!("2100-01-01T03:00:00+03:00"));
    let mut unit = repo.read(&c).await.unwrap();
    let first = unit.select(&c).await.unwrap();
    assert_eq!(first.total, 2);
    assert_eq!(first.items.len(), 1);
    unit.commit().await.unwrap();
    c.query.insert("offset".into(), json!(1));
    let mut unit = repo.read(&c).await.unwrap();
    let next = unit.select(&c).await.unwrap();
    assert_eq!(next.total, 2);
    assert_ne!(first.items[0]["id"], next.items[0]["id"]);
    unit.commit().await.unwrap();
    c.query.insert("name".into(), json!("_100%"));
    c.query.remove("offset");
    let mut unit = repo.read(&c).await.unwrap();
    assert_eq!(unit.select(&c).await.unwrap().total, 1);
    unit.commit().await.unwrap();
    c.query.insert("offset".into(), json!(99));
    let mut unit = repo.read(&c).await.unwrap();
    let empty = unit.select(&c).await.unwrap();
    assert_eq!(empty.total, 1);
    assert!(empty.items.is_empty());
    unit.commit().await.unwrap();
    drop(repo);
    pool.close().await;
    std::fs::remove_file(path).unwrap();
}
#[tokio::test]
async fn role_swaps_release_old_bindings_and_invalid_final_roles_roll_back() {
    let (url, path) = url();
    let pool = sqlite::connect(&url).await.unwrap();
    let repo = ResourceRepository::new(pool.clone());
    let leader = add(&repo, "Leader").await;
    let collaborator = add(&repo, "Collaborator").await;
    let mut unit = repo.begin().await.unwrap();
    let team = unit.records.insert(Record::new(
        "teams",
        json!({"slug":"team","leaderId":leader}),
    ));
    let membership = unit.records.insert(Record::new(
        "memberships",
        json!({"teamId":team,"agentId":collaborator}),
    ));
    unit.commit().await.unwrap();
    let mut unit = repo.begin().await.unwrap();
    unit.records.get_mut("teams", team).unwrap().data["leaderId"] = json!(collaborator);
    unit.records
        .get_mut("memberships", membership)
        .unwrap()
        .data["agentId"] = json!(leader);
    unit.commit().await.unwrap();
    let mut unit = repo.begin().await.unwrap();
    unit.records
        .get_mut("memberships", membership)
        .unwrap()
        .data["agentId"] = json!(collaborator);
    assert_eq!(
        unit.commit().await.unwrap_err().code,
        "usage_policy_conflict"
    );
    let unit = repo.begin().await.unwrap();
    assert_eq!(
        unit.records
            .get("memberships", membership)
            .unwrap()
            .reference("agentId"),
        Some(leader)
    );
    drop(unit);
    drop(repo);
    pool.close().await;
    std::fs::remove_file(path).unwrap();
}
#[tokio::test]
async fn in_memory_database_uses_one_shared_pool_schema() {
    let pool = sqlite::connect("sqlite::memory:").await.unwrap();
    let repo = ResourceRepository::new(pool.clone());
    let id = add(&repo, "Memory").await;
    assert_eq!(repo.resolve_slug("agents", "memory").await.unwrap().0, id);
    drop(repo);
    pool.close().await;
}
