use beeteam::{
    config::DatabaseDriver,
    repositories::{
        database::DatabaseRepository,
        transfer::archive::{ArchiveStore, Limits},
    },
};
use std::sync::Arc;
#[tokio::test]
async fn sqlite_empty_snapshot_is_complete_and_legacy_free() {
    let dir = tempfile::tempdir().unwrap();
    let db = DatabaseRepository::connect(
        DatabaseDriver::Sqlite,
        &format!("sqlite://{}", dir.path().join("source.db").display()),
    )
    .await
    .unwrap();
    let store =
        Arc::new(ArchiveStore::new(dir.path().join("artifacts"), Limits::default()).unwrap());
    let id = uuid::Uuid::now_v7();
    let manifest = db.transfers().export(store.clone(), id).await.unwrap();
    assert_eq!(manifest.source_driver, "sqlite");
    let groups=beeteam::repositories::transfer::archive::groups();
    assert_eq!(manifest.entries.len(), groups.len());
    for group in groups {assert!(manifest.entries.contains_key(&format!("records/{group}.jsonl")));}
    assert!(db.transfers().destination().await.unwrap().empty);
    store.validate_archive(id).unwrap();
}
