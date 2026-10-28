use beeteam::repositories::transfer::{
    archive::{ArchiveStore, Limits},
    contracts::TransferDatabase,
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;
enum Pool {
    Pg(sqlx::PgPool),
    Lite(sqlx::SqlitePool),
}
impl Pool {
    async fn new(dir: &std::path::Path, pg: bool) -> Self {
        if pg {
            let url = std::env::var("BEE_TEST_DATABASE_URL").unwrap();
            let admin = beeteam::db::init_pool(&url).await.unwrap();
            let name = format!("bee_snapshot_{}", Uuid::new_v4().simple());
            sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
                .execute(&admin)
                .await
                .unwrap();
            let mut url = url::Url::parse(&url).unwrap();
            url.set_path(&name);
            let pool = beeteam::db::init_pool(url.as_str()).await.unwrap();
            beeteam::db::run_migrations(&pool).await.unwrap();
            Self::Pg(pool)
        } else {
            Self::Lite(
                beeteam::repositories::sqlite::connect(&format!(
                    "sqlite://{}",
                    dir.join("db.sqlite").display()
                ))
                .await
                .unwrap(),
            )
        }
    }
    fn transfers(&self) -> Arc<dyn TransferDatabase> {
        match self {
            Self::Pg(pool) => Arc::new(
                beeteam::repositories::transfer::postgres::TransferRepository::new(pool.clone()),
            ),
            Self::Lite(pool) => Arc::new(
                beeteam::repositories::transfer::sqlite::TransferRepository::new(pool.clone()),
            ),
        }
    }
    async fn seed(&self) {
        for n in 0..200 {
            let id = Uuid::now_v7();
            let data = json!({"slug":format!("agent-{n}"),"name":"before"});
            match self {
                Self::Pg(p) => {
                    sqlx::query("INSERT INTO agents(id,data,created_at,updated_at) VALUES($1,$2,now(),now())").bind(id).bind(data).execute(p).await.unwrap();
                }
                Self::Lite(p) => {
                    sqlx::query(
                        "INSERT INTO agents(id,data,created_at,updated_at) VALUES($1,$2,$3,$3)",
                    )
                    .bind(id.to_string())
                    .bind(data.to_string())
                    .bind("2026-10-28T00:00:00Z")
                    .execute(p)
                    .await
                    .unwrap();
                }
            }
        }
    }
    async fn update(&self) {
        match self {
            Self::Pg(p) => {
                sqlx::query("UPDATE agents SET data=jsonb_set(data,'{name}','\"after\"')")
                    .execute(p)
                    .await
                    .unwrap();
            }
            Self::Lite(p) => {
                sqlx::query("UPDATE agents SET data=json_set(data,'$.name','after')")
                    .execute(p)
                    .await
                    .unwrap();
            }
        }
    }
}
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn both_drivers_keep_snapshot_during_concurrent_writes() {
    for pg in [false, true] {
        let dir = tempfile::tempdir().unwrap();
        let pool = Pool::new(dir.path(), pg).await;
        pool.seed().await;
        let store =
            Arc::new(ArchiveStore::new(dir.path().join("files"), Limits::default()).unwrap());
        let id = Uuid::now_v7();
        let db = pool.transfers();
        let archive = store.clone();
        let task = tokio::spawn(async move { db.export(archive, id).await.unwrap() });
        loop {
            if store.read_progress(id).unwrap().is_some() {
                break;
            }
            assert!(
                !task.is_finished(),
                "snapshot completed before concurrent writer test"
            );
            tokio::task::yield_now().await;
        }
        pool.update().await;
        task.await.unwrap();
        store.validate_archive(id).unwrap();
        let rows = store.rows(id, "agents").unwrap();
        assert_eq!(rows.len(), 200);
        assert!(rows.iter().all(|r| r["data"]["name"] == "before"));
        let next = Uuid::now_v7();
        pool.transfers().export(store.clone(), next).await.unwrap();
        store.validate_archive(next).unwrap();
        assert!(store
            .rows(next, "agents")
            .unwrap()
            .iter()
            .all(|r| r["data"]["name"] == "after"));
    }
}

#[tokio::test]
async fn postgres_writer_lock_wait_can_be_cancelled() {
    let dir = tempfile::tempdir().unwrap();
    let pool = Pool::new(dir.path(), true).await;
    let db = pool.transfers();
    let target = db.destination().await.unwrap();
    let store = Arc::new(ArchiveStore::new(dir.path().join("files"), Limits::default()).unwrap());
    let id = Uuid::now_v7();
    store.create_stage(id).unwrap();
    let manifest = store.seal(id, "sqlite", 0).unwrap();
    let hash = store.digest(id).unwrap();
    let Pool::Pg(pool) = pool else { unreachable!() };
    let mut blocker = pool.begin().await.unwrap();
    sqlx::query("SELECT pg_advisory_xact_lock(1884347301)")
        .execute(&mut *blocker)
        .await
        .unwrap();
    let archive = store.clone();
    let task = tokio::spawn(async move {
        db.restore(
            archive,
            id,
            manifest,
            target.id,
            beeteam::dto::data_transfer::TimestampPolicy::Strict,
            hash,
        )
        .await
    });
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    store.cancel(id).unwrap();
    let error = tokio::time::timeout(std::time::Duration::from_secs(2), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap_err();
    assert!(error.to_string().contains("cancel"));
    blocker.rollback().await.unwrap();
}
