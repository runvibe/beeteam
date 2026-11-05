use beeteam::{
    dto::data_transfer::TimestampPolicy,
    repositories::{
        database::DatabaseRepository,
        transfer::archive::{ArchiveStore, Limits},
    },
};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

async fn database(dir: &std::path::Path, postgres: bool) -> DatabaseRepository {
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
        DatabaseRepository::connect(beeteam::config::DatabaseDriver::Postgres, url.as_str())
            .await
            .unwrap()
    } else {
        DatabaseRepository::connect(
            beeteam::config::DatabaseDriver::Sqlite,
            &format!(
                "sqlite://{}",
                dir.join(format!("{}.db", Uuid::new_v4())).display()
            ),
        )
        .await
        .unwrap()
    }
}

async fn roundtrip(pg_source: bool, pg_dest: bool) {
    let dir = tempfile::tempdir().unwrap();
    let source = database(dir.path(), pg_source).await;
    let dest = database(dir.path(), pg_dest).await;
    let store = Arc::new(ArchiveStore::new(dir.path().join("files"), Limits::default()).unwrap());
    let id = Uuid::now_v7();
    store.create_stage(id).unwrap();
    let agent = Uuid::now_v7();
    let blob = Uuid::now_v7();
    let timestamp = "2026-10-28T12:34:56.123456Z";
    let data = json!({"slug":"deleted-agent","name":"ação 😀","null":null,"empty":"","large":9223372036854775807i64,"markdown":"# Literal\n<script>not executed</script>"});
    store.append(id,"records/agents.jsonl",&json!({"id":agent,"data":data,"version":9,"createdAt":timestamp,"updatedAt":timestamp,"archivedAt":timestamp,"deletedAt":timestamp})).unwrap();
    let content = vec![173u8; 150_000];
    store.write_blob(id, blob, &content).unwrap();
    store.append(id,"records/file_contents.jsonl",&json!({"id":blob,"blob":format!("blobs/{blob}.bin"),"bytes":content.len(),"createdAt":timestamp,"deletedAt":timestamp})).unwrap();
    let replay =
        json!({"legacy":true,"snapshot":{"currentSummary":"","specification":"# original collaborator","collaboratorIconId":"lightbulb","actorRole":"collaborator"}});
    store.append(id,"records/request_replays.jsonl",&json!({"id":Uuid::now_v7(),"requestKey":Uuid::new_v4(),"actorKey":"human","operation":"createAgent","requestHash":"original","response":replay,"createdAt":timestamp,"expiresAt":timestamp,"deletedAt":null})).unwrap();
    let team = Uuid::now_v7();
    let board = Uuid::now_v7();
    let other_board = Uuid::now_v7();
    let status = Uuid::now_v7();
    let other_status = Uuid::now_v7();
    let task = Uuid::now_v7();
    let child = Uuid::now_v7();
    let plan = Uuid::now_v7();
    let mut fixtures = vec![
        (
            "teams",
            team,
            json!({"slug":"history-team","leaderId":agent,"collaboratorIconId":"lightbulb","context":"worker and collaborator are authored text"}),
        ),
        ("boards", board, json!({"teamId":team})),
        ("boards", other_board, json!({"teamId":team})),
        ("statuses", status, json!({"boardId":board})),
        ("statuses", other_status, json!({"boardId":other_board})),
        // Child intentionally precedes parent in JSONL; restore must topologically order it.
        (
            "tasks",
            child,
            json!({"slug":"child","boardId":other_board,"statusId":other_status,"parentId":task,"rootTaskId":task,"originBoardId":board,"authorAgentId":agent,"executorAgentId":agent,"specification":"## Child","currentSummary":"child work"}),
        ),
        (
            "tasks",
            task,
            json!({"slug":"root","boardId":board,"statusId":status,"parentId":null,"rootTaskId":task,"originBoardId":board,"authorAgentId":agent,"executorAgentId":agent,"specification":"## Requirements\n<script>literal</script>","currentSummary":"author synthesis"}),
        ),
        ("plans", plan, json!({"taskId":task})),
        (
            "plan_revisions",
            Uuid::now_v7(),
            json!({"taskId":task,"planId":plan,"content":"# Plan\n- literal Markdown"}),
        ),
        (
            "events",
            Uuid::now_v7(),
            json!({"taskId":task,"sequence":99}),
        ),
        (
            "attachments",
            Uuid::now_v7(),
            json!({"taskId":task,"contentId":blob}),
        ),
        (
            "images",
            Uuid::now_v7(),
            json!({"agentId":agent,"contentId":blob}),
        ),
        (
            "memberships",
            Uuid::now_v7(),
            json!({"teamId":team,"agentId":agent}),
        ),
        ("chat_references", Uuid::now_v7(), json!({"agentId":agent})),
        ("board_events", Uuid::now_v7(), json!({"boardId":board})),
    ];
    for group in ["comments", "execution_summaries"] {
        fixtures.push((
            group,
            Uuid::now_v7(),
            json!({"taskId":task,"content":"historical text"}),
        ));
    }
    let summary=fixtures.iter().find(|(g,_,_)|*g=="execution_summaries").unwrap().1;
    let execution=Uuid::now_v7();let interval=Uuid::now_v7();
    fixtures.extend([
        ("task_executions",execution,json!({"taskId":task,"agentId":agent,"startSummaryId":summary,"source":"fixture","sessionId":"session","coverageRootSessionId":"session","state":"finished"})),
        ("task_execution_intervals",interval,json!({"taskId":task,"executionId":execution,"startSummaryId":summary,"endSummaryId":summary,"source":"fixture","sessionId":"session","coverageRootSessionId":"session","state":"closed","totalTokens":"9007199254740993","reason":"Literal correction"})),
        ("task_execution_interval_counters",Uuid::now_v7(),json!({"taskId":task,"intervalId":interval,"counterKey":"global","calculation":{"segments":[{"startSummaryId":summary,"delta":{"totalTokens":"9007199254740993"}}]}})),
        ("task_execution_tracking_events",Uuid::now_v7(),json!({"taskId":task,"executionId":execution,"intervalId":interval,"summaryId":summary,"action":"finish","evidence":[]})),
        ("task_execution_interval_revisions",Uuid::now_v7(),json!({"taskId":task,"intervalId":interval,"revision":1,"interval":{"partialTokens":null},"reason":"audit"})),
    ]);
    for (group, rid, payload) in &fixtures {
        store.append(id,&format!("records/{group}.jsonl"),&json!({"id":rid,"data":payload,"version":7,"createdAt":timestamp,"updatedAt":timestamp,"archivedAt":timestamp,"deletedAt":timestamp})).unwrap();
    }
    let manifest = store.seal(id, "sqlite", 100).unwrap();
    let target = source.transfers().destination().await.unwrap();
    source
        .transfers()
        .restore(
            store.clone(),
            id,
            manifest,
            target.id,
            TimestampPolicy::Strict,
            store.digest(id).unwrap(),
        )
        .await
        .unwrap();
    let exported = Uuid::now_v7();
    let manifest = source
        .transfers()
        .export(store.clone(), exported)
        .await
        .unwrap();
    let target = dest.transfers().destination().await.unwrap();
    let (_, changes) = dest.stores();
    let mut notifications = changes.connect().await.unwrap();
    dest.transfers()
        .restore(
            store.clone(),
            exported,
            manifest.clone(),
            target.id,
            TimestampPolicy::Strict,
            store.digest(exported).unwrap(),
        )
        .await
        .unwrap();
    assert!(dest.transfers().committed(exported).await.unwrap());
    assert!(
        tokio::time::timeout(std::time::Duration::from_secs(3), notifications.next())
            .await
            .unwrap()
            .unwrap()
    );
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(300), notifications.next())
            .await
            .is_err()
    );
    let (resources, _) = dest.stores();
    let mut transaction = resources.begin().await.unwrap();
    assert!(transaction.sequence().await.unwrap() > 100);
    drop(transaction);

    assert!(!dest.transfers().destination().await.unwrap().empty);
    // Committed retries return success despite destination now containing data.
    dest.transfers()
        .restore(
            store.clone(),
            exported,
            manifest,
            target.id,
            TimestampPolicy::Strict,
            store.digest(exported).unwrap(),
        )
        .await
        .unwrap();
    let final_id = Uuid::now_v7();
    dest.transfers()
        .export(store.clone(), final_id)
        .await
        .unwrap();
    store.validate_archive(final_id).unwrap();
    for (group, rid, payload) in fixtures {
        let rows = store.rows(final_id, group).unwrap();
        let row = rows.iter().find(|v| v["id"] == rid.to_string()).unwrap();
        assert_eq!(row["data"], payload);
        assert_eq!(row["version"], 7);
    }
    let rows = store.rows(final_id, "agents").unwrap();
    assert_eq!(rows[0]["data"], data);
    assert_eq!(rows[0]["version"], 9);
    assert!(!rows[0]["deletedAt"].is_null());
    assert_eq!(
        store.rows(final_id, "request_replays").unwrap()[0]["response"],
        replay
    );
    use std::io::Read;
    let mut restored = Vec::new();
    store
        .blob_reader(final_id, blob)
        .unwrap()
        .read_to_end(&mut restored)
        .unwrap();
    assert_eq!(restored, content);
    let extra = Uuid::now_v7();
    let manifest = source
        .transfers()
        .export(store.clone(), extra)
        .await
        .unwrap();
    let error = dest
        .transfers()
        .restore(
            store.clone(),
            extra,
            manifest,
            target.id,
            TimestampPolicy::Strict,
            store.digest(extra).unwrap(),
        )
        .await
        .unwrap_err();
    assert!(error.to_string().contains("destination_not_empty"));
    assert!(!dest.transfers().committed(extra).await.unwrap());
}
#[tokio::test]
async fn sqlite_sqlite() {
    roundtrip(false, false).await;
}
#[tokio::test]
async fn postgres_sqlite() {
    roundtrip(true, false).await;
}
#[tokio::test]
async fn sqlite_postgres() {
    roundtrip(false, true).await;
}
#[tokio::test]
async fn postgres_postgres() {
    roundtrip(true, true).await;
}

#[tokio::test]
async fn strict_precision_rolls_back_and_opt_in_changes_only_metadata() {
    let dir = tempfile::tempdir().unwrap();
    let dest = database(dir.path(), true).await;
    let store =
        Arc::new(ArchiveStore::new(dir.path().join("precision"), Limits::default()).unwrap());
    let id = Uuid::now_v7();
    store.create_stage(id).unwrap();
    let timestamp = "2026-10-28T12:34:56.123456789Z";
    let payload =
        json!({"slug":"precision","literalDate":timestamp,"markdown":format!("# {timestamp}")});
    store.append(id,"records/agents.jsonl",&json!({"id":Uuid::now_v7(),"data":payload,"version":1,"createdAt":timestamp,"updatedAt":timestamp,"archivedAt":null,"deletedAt":null})).unwrap();
    let blob = Uuid::now_v7();
    store.write_blob(id, blob, b"must roll back").unwrap();
    store.append(id,"records/file_contents.jsonl",&json!({"id":blob,"blob":format!("blobs/{blob}.bin"),"bytes":14,"createdAt":"2026-10-28T12:34:56Z","deletedAt":null})).unwrap();
    let manifest = store.seal(id, "sqlite", 0).unwrap();
    store.validate_archive(id).unwrap();
    assert_eq!(
        beeteam::services::data_transfer::validation::inspect(&store, id, &manifest, "postgres")
            .unwrap(),
        2
    );
    let target = dest.transfers().destination().await.unwrap();
    let hash = store.digest(id).unwrap();
    let error = dest
        .transfers()
        .restore(
            store.clone(),
            id,
            manifest.clone(),
            target.id,
            TimestampPolicy::Strict,
            hash.clone(),
        )
        .await
        .unwrap_err();
    assert!(error.to_string().contains("timestamp_precision_loss"));
    assert!(dest.transfers().destination().await.unwrap().empty);
    assert!(!dest.transfers().committed(id).await.unwrap());
    dest.transfers()
        .restore(
            store.clone(),
            id,
            manifest,
            target.id,
            TimestampPolicy::TruncateToMicroseconds,
            hash,
        )
        .await
        .unwrap();
    let exported = Uuid::now_v7();
    dest.transfers()
        .export(store.clone(), exported)
        .await
        .unwrap();
    store.validate_archive(exported).unwrap();
    let row = &store.rows(exported, "agents").unwrap()[0];
    assert_eq!(row["data"], payload);
    assert!(row["createdAt"].as_str().unwrap().contains(".123456"));
    assert!(!row["createdAt"].as_str().unwrap().contains("789"));
}
#[tokio::test]
async fn duplicate_id_rolls_back_every_insert_in_both_drivers() {
    for pg in [false, true] {
        let dir = tempfile::tempdir().unwrap();
        let dest = database(dir.path(), pg).await;
        let store =
            Arc::new(ArchiveStore::new(dir.path().join("rollback"), Limits::default()).unwrap());
        let id = Uuid::now_v7();
        store.create_stage(id).unwrap();
        let row = json!({"id":Uuid::now_v7(),"data":{"slug":"duplicate"},"version":1,"createdAt":"2026-10-28T00:00:00Z","updatedAt":"2026-10-28T00:00:00Z","archivedAt":null,"deletedAt":null});
        store.append(id, "records/agents.jsonl", &row).unwrap();
        store.append(id, "records/agents.jsonl", &row).unwrap();
        let manifest = store.seal(id, "sqlite", 0).unwrap();
        let target = dest.transfers().destination().await.unwrap();
        assert!(dest
            .transfers()
            .restore(
                store.clone(),
                id,
                manifest,
                target.id,
                TimestampPolicy::Strict,
                store.digest(id).unwrap()
            )
            .await
            .is_err());
        assert!(dest.transfers().destination().await.unwrap().empty);
        assert!(!dest.transfers().committed(id).await.unwrap());
    }
}
