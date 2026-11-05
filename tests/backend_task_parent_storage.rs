mod support;
use beeteam::{
    dto::backend::{Actor, Command, Outcome, Result, Upload},
    repositories::{contracts::ResourceStore, local_git::LocalGitDiscovery},
    services::backend::service::BackendService,
};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

enum Database {
    Sqlite(sqlx::SqlitePool),
    Postgres(sqlx::PgPool),
}
impl Database {
    async fn migrate(&self, include_link: bool) {
        let (mut migrator, cutoff) = match self {
            Self::Sqlite(_) => (sqlx::migrate!("./migrations/sqlite"), 6),
            Self::Postgres(_) => (sqlx::migrate!("./migrations"), 202611050001),
        };
        if !include_link {
            migrator.migrations = std::borrow::Cow::Owned(
                migrator
                    .iter()
                    .filter(|m| m.version < cutoff)
                    .cloned()
                    .collect(),
            );
        }
        match self {
            Self::Sqlite(pool) => migrator.run(pool).await.unwrap(),
            Self::Postgres(pool) => migrator.run(pool).await.unwrap(),
        }
    }
    async fn reject_audit(&self, enabled: bool) {
        match self {
            Self::Sqlite(pool) => {
                let sql = if enabled {
                    "CREATE TRIGGER reject_parent_audit BEFORE INSERT ON events WHEN json_extract(NEW.data,'$.type')='task.parent_changed' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END"
                } else {
                    "DROP TRIGGER reject_parent_audit"
                };
                sqlx::raw_sql(sql).execute(pool).await.unwrap();
            }
            Self::Postgres(pool) => {
                let sql = if enabled {
                    "CREATE FUNCTION reject_parent_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.data->>'type'='task.parent_changed' THEN RAISE EXCEPTION 'injected audit failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_parent_audit BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_parent_audit()"
                } else {
                    "DROP TRIGGER reject_parent_audit ON events; DROP FUNCTION reject_parent_audit()"
                };
                sqlx::raw_sql(sql).execute(pool).await.unwrap();
            }
        }
    }
}
fn command(operation: &str, params: &[(&str, Uuid)], body: Value, version: Option<i64>) -> Command {
    Command {
        operation: operation.into(),
        params: params
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect(),
        query: Default::default(),
        body,
        actor: Some(Actor {
            kind: "human".into(),
            id: None,
        }),
        expected_version: version,
        idempotency_key: Some(Uuid::new_v4()),
        upload: None,
    }
}
async fn run(service: &BackendService, op: &str, params: &[(&str, Uuid)], body: Value) -> Value {
    service
        .execute(command(op, params, body, None))
        .await
        .unwrap()
        .data
}
fn id(value: &Value) -> Uuid {
    Uuid::parse_str(value["id"].as_str().unwrap()).unwrap()
}
async fn rollback_case(repo: Arc<dyn ResourceStore>, database: Database) {
    database.migrate(false).await;
    let service = BackendService::new(repo.clone(), Arc::new(LocalGitDiscovery::default()));
    let agent = run(
        &service,
        "createAgent",
        &[],
        json!({"name":"Rollback worker"}),
    )
    .await;
    let team = run(&service,"createTeam",&[],json!({"name":"Rollback team","leaderId":id(&agent),"coordinationContext":support::manual()})).await;
    let board = run(
        &service,
        "createBoard",
        &[],
        json!({"name":"Rollback board","teamId":id(&team)}),
    )
    .await;
    let mut tasks = vec![];
    for title in ["Older root", "Newer parent"] {
        tasks.push(run(&service,"createTask",&[("boardId",id(&board))],json!({"title":title,"authorAgentId":id(&agent),"executorAgentId":id(&agent),"workScope":support::test_project_scope(),"coordinationContext":support::manual()})).await);
    }
    let mut upload = command(
        "createAttachment",
        &[("taskId", id(&tasks[0]))],
        json!({"description":"Original attachment"}),
        tasks[0]["version"].as_i64(),
    );
    upload.upload = Some(Upload {
        name: "original.txt".into(),
        media_type: "text/plain".into(),
        bytes: b"Original attachment bytes\n".to_vec(),
    });
    let attachment = service.execute(upload).await.unwrap().data;
    let mut unit = repo.begin().await.unwrap();
    let file_id = unit
        .records
        .get("attachments", id(&attachment))
        .unwrap()
        .reference("contentId")
        .unwrap();
    let bytes = unit.file(file_id).await.unwrap();
    let before = unit.records.rows.clone();
    unit.rollback().await.unwrap();
    // Upgrade an already populated old schema, preserving every record and blob.
    database.migrate(true).await;
    let mut unit = repo.begin().await.unwrap();
    assert_eq!(unit.records.rows, before);
    assert_eq!(unit.file(file_id).await.unwrap(), bytes);
    unit.rollback().await.unwrap();
    let request = command(
        "linkTaskToParent",
        &[("taskId", id(&tasks[0]))],
        json!({"parentId":id(&tasks[1]),"parentVersion":tasks[1]["version"],"coordinationContext":support::manual()}),
        Some(before[&("tasks", id(&tasks[0]))].version),
    );
    database.reject_audit(true).await;
    let failed: Result<Outcome> = service.execute(request.clone()).await;
    assert!(
        failed.is_err(),
        "injected failure must roll back task/context writes and replay"
    );
    let unit = repo.begin().await.unwrap();
    assert_eq!(unit.records.rows, before);
    unit.rollback().await.unwrap();
    database.reject_audit(false).await;
    let result = service.execute(request.clone()).await.unwrap();
    assert_eq!(result.data["parentId"], tasks[1]["id"]);
    assert_eq!(service.execute(request).await.unwrap().data, result.data);
    let mut unit = repo.begin().await.unwrap();
    for (key, record) in &before {
        if key.0 != "tasks" {
            assert_eq!(unit.records.rows.get(key), Some(record), "{key:?}");
        }
    }
    assert_eq!(unit.file(file_id).await.unwrap(), bytes);
    unit.rollback().await.unwrap();
}
#[tokio::test]
async fn sqlite_storage_failure_rolls_back_hierarchy_audit_and_replay() {
    let dir = tempfile::tempdir().unwrap();
    let url = format!(
        "sqlite://{}",
        dir.path()
            .join("rollback.db")
            .to_string_lossy()
            .replace('\\', "/")
    );
    let options = url
        .parse::<sqlx::sqlite::SqliteConnectOptions>()
        .unwrap()
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .with_regexp()
        .collation("beeteam_nocase", |a, b| {
            a.to_lowercase().cmp(&b.to_lowercase())
        });
    let pool = sqlx::sqlite::SqlitePoolOptions::new()
        .connect_with(options)
        .await
        .unwrap();
    rollback_case(
        Arc::new(beeteam::repositories::sqlite::ResourceRepository::new(
            pool.clone(),
        )),
        Database::Sqlite(pool),
    )
    .await;
}
#[tokio::test]
async fn postgres_storage_failure_rolls_back_hierarchy_audit_and_replay() {
    let url = std::env::var("BEE_TEST_DATABASE_URL").expect("isolated PostgreSQL18 URL");
    let admin = beeteam::db::init_pool(&url).await.unwrap();
    let name = format!("bee_parent_upgrade_{}", Uuid::new_v4().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
        .execute(&admin)
        .await
        .unwrap();
    let mut url = url::Url::parse(&url).unwrap();
    url.set_path(&name);
    let pool = beeteam::db::init_pool(url.as_str()).await.unwrap();
    rollback_case(
        Arc::new(beeteam::repositories::resources::ResourceRepository::new(
            pool.clone(),
        )),
        Database::Postgres(pool),
    )
    .await;
}
