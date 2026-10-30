use beeteam::{
    config::DatabaseDriver,
    dto::data_transfer::TimestampPolicy,
    repositories::{
        database::DatabaseRepository,
        transfer::archive::{ArchiveStore, Limits},
    },
};
use std::sync::Arc;
#[tokio::test]
async fn sqlite_empty_restore_commits_marker_and_retries_without_duplicate_work() {
    let dir = tempfile::tempdir().unwrap();
    let source = DatabaseRepository::connect(
        DatabaseDriver::Sqlite,
        &format!("sqlite://{}", dir.path().join("source.db").display()),
    )
    .await
    .unwrap();
    let dest = DatabaseRepository::connect(
        DatabaseDriver::Sqlite,
        &format!("sqlite://{}", dir.path().join("dest.db").display()),
    )
    .await
    .unwrap();
    let store =
        Arc::new(ArchiveStore::new(dir.path().join("artifacts"), Limits::default()).unwrap());
    let id = uuid::Uuid::now_v7();
    let manifest = source.transfers().export(store.clone(), id).await.unwrap();
    store.validate_archive(id).unwrap();
    let target = dest.transfers().destination().await.unwrap();
    let hash = store.digest(id).unwrap();
    dest.transfers()
        .restore(
            store.clone(),
            id,
            manifest.clone(),
            target.id,
            TimestampPolicy::Strict,
            hash.clone(),
        )
        .await
        .unwrap();
    assert!(dest.transfers().committed(id).await.unwrap());
    dest.transfers()
        .restore(
            store,
            id,
            manifest,
            target.id,
            TimestampPolicy::Strict,
            hash,
        )
        .await
        .unwrap();
}
