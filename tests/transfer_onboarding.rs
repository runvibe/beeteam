use beeteam::{
    dto::data_transfer::TimestampPolicy,
    repositories::{
        database::DatabaseRepository,
        transfer::archive::{ArchiveStore, Limits},
    },
    services::backend::onboarding,
};
use std::sync::Arc;
use uuid::Uuid;

async fn database(dir: &std::path::Path, postgres: bool) -> DatabaseRepository {
    connect(dir, postgres).await.0
}

async fn connect(dir: &std::path::Path, postgres: bool) -> (DatabaseRepository, String) {
    if postgres {
        let url = std::env::var("BEE_TEST_DATABASE_URL").expect("isolated PostgreSQL test URL");
        let admin = beeteam::db::init_pool(&url).await.unwrap();
        let name = format!("bee_transfer_{}", Uuid::new_v4().simple());
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
            .execute(&admin)
            .await
            .unwrap();
        let mut url = url::Url::parse(&url).unwrap();
        url.set_path(&name);
        let db = DatabaseRepository::connect(beeteam::config::DatabaseDriver::Postgres, url.as_str())
            .await
            .unwrap();
        (db, url.to_string())
    } else {
        let url = format!("sqlite://{}", dir.join(format!("{}.db", Uuid::new_v4())).display());
        let db = DatabaseRepository::connect(beeteam::config::DatabaseDriver::Sqlite, &url)
            .await
            .unwrap();
        (db, url)
    }
}

async fn seed(db: &DatabaseRepository) -> onboarding::OnboardingIds {
    onboarding::ensure(db.stores().0.as_ref()).await.unwrap()
}

async fn restore(store: &Arc<ArchiveStore>, source: &DatabaseRepository, dest: &DatabaseRepository) -> anyhow::Result<()> {
    let id = Uuid::now_v7();
    let manifest = source.transfers().export(store.clone(), id).await?;
    let target = dest.transfers().destination().await?;
    dest.transfers()
        .restore(store.clone(), id, manifest, target.id, TimestampPolicy::Strict, store.digest(id)?)
        .await
}

async fn pristine_seed_counts_as_empty(source_pg: bool, dest_pg: bool) {
    let dir = tempfile::tempdir().unwrap();
    let store = Arc::new(ArchiveStore::new(dir.path().join("files"), Limits::default()).unwrap());
    let source = database(dir.path(), source_pg).await;
    let source_ids = seed(&source).await;
    let (resources, _) = source.stores();
    let mut unit = resources.begin().await.unwrap();
    let mut user = beeteam::repositories::records::Record::new("agents", serde_json::json!({"name":"User","slug":"user"}));
    user.data["note"] = serde_json::json!("kept");
    unit.records.insert(user);
    unit.commit().await.unwrap();
    assert!(!source.transfers().destination().await.unwrap().empty, "user rows make the source non-empty");

    let dest = database(dir.path(), dest_pg).await;
    let dest_ids = seed(&dest).await;
    assert_ne!(source_ids.team_id, dest_ids.team_id);
    assert!(dest.transfers().destination().await.unwrap().empty);
    restore(&store, &source, &dest).await.unwrap();
    assert!(!dest.transfers().destination().await.unwrap().empty);
    let after = seed(&dest).await;
    assert_eq!((after.team_id, after.agent_id, after.board_id), (source_ids.team_id, source_ids.agent_id, source_ids.board_id));
    let unit = dest.stores().0.begin().await.unwrap();
    assert_eq!(unit.records.list("teams").len(), 1);
    assert_eq!(unit.records.list("agents").len(), 2);
    assert!(unit.records.get("teams", dest_ids.team_id).is_err());
    unit.rollback().await.unwrap();

    let edited = database(dir.path(), dest_pg).await;
    let ids = seed(&edited).await;
    let (resources, _) = edited.stores();
    let mut unit = resources.begin().await.unwrap();
    let board = unit.records.get_mut("boards", ids.board_id).unwrap();
    board.data["description"] = serde_json::json!("Mine");
    board.touch();
    unit.commit().await.unwrap();
    assert!(!edited.transfers().destination().await.unwrap().empty);
    let error = restore(&store, &source, &edited).await.unwrap_err();
    assert!(error.to_string().contains("destination_not_empty"), "{error}");
}

#[tokio::test]
async fn sqlite_sqlite() {
    pristine_seed_counts_as_empty(false, false).await;
}
#[tokio::test]
async fn sqlite_postgres() {
    pristine_seed_counts_as_empty(false, true).await;
}
#[tokio::test]
async fn postgres_sqlite() {
    pristine_seed_counts_as_empty(true, false).await;
}

#[tokio::test]
async fn pristine_seed_rows_stay_undeletable_outside_restore() {
    let dir = tempfile::tempdir().unwrap();
    for postgres in [false, true] {
        let (db, url) = connect(dir.path(), postgres).await;
        seed(&db).await;
        for table in ["events", "tasks", "agents"] {
            let sql = format!("DELETE FROM {table}");
            let error = if postgres {
                let pool = sqlx::PgPool::connect(&url).await.unwrap();
                sqlx::query(sqlx::AssertSqlSafe(sql)).execute(&pool).await.unwrap_err()
            } else {
                let pool = sqlx::SqlitePool::connect(&url).await.unwrap();
                sqlx::query(sqlx::AssertSqlSafe(sql)).execute(&pool).await.unwrap_err()
            };
            assert!(error.to_string().contains("Physical deletion is disabled"), "{error}");
        }
    }
}
