use beeteam::{
    config::DatabaseDriver,
    dto::data_transfer::{RestoreRequest, TimestampPolicy},
    repositories::{
        database::DatabaseRepository,
        transfer::{
            archive::{ArchiveStore, Limits},
            jobs::JobStore,
        },
    },
    services::data_transfer::{config::TransferConfig, service::TransferService},
};
use uuid::Uuid;
async fn service(dir: &std::path::Path) -> TransferService {
    let db = DatabaseRepository::connect(
        DatabaseDriver::Sqlite,
        &format!("sqlite://{}", dir.join("database.sqlite").display()),
    )
    .await
    .unwrap();
    TransferService::new(
        db.transfers(),
        TransferConfig {
            enabled: true,
            directory: dir.join("jobs"),
            origins: vec!["http://localhost:5173".into()],
            limits: Limits::default(),
            retention_seconds: 86400,
        },
    )
    .unwrap()
}
async fn terminal(service: &TransferService, id: Uuid) -> beeteam::dto::data_transfer::Job {
    for _ in 0..200 {
        let job = service.status(id).await.unwrap();
        if !matches!(job.state.as_str(), "running" | "restoring" | "queued") {
            return job;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    panic!("job did not finish")
}
#[tokio::test]
async fn durable_upload_preview_restore_and_replay() {
    let dir = tempfile::tempdir().unwrap();
    let service = service(dir.path()).await;
    let fixtures = ArchiveStore::new(dir.path().join("fixture"), Limits::default()).unwrap();
    let archive = Uuid::now_v7();
    fixtures.create_stage(archive).unwrap();
    fixtures.seal(archive, "sqlite", 0).unwrap();
    let hash = fixtures.digest(archive).unwrap();
    let bytes = std::fs::read(fixtures.archive_path(archive)).unwrap();
    let key = Uuid::new_v4();
    let mut upload = service
        .begin_import(key, &hash)
        .await
        .unwrap()
        .ok()
        .unwrap();
    let id = upload.job.id;
    assert!(service
        .export(Uuid::new_v4())
        .await
        .unwrap_err()
        .to_string()
        .contains("transfer_busy"));
    for chunk in bytes.chunks(97) {
        upload.append(chunk).unwrap();
    }
    upload.finish().await.unwrap();
    let job = terminal(&service, id).await;
    assert_eq!(job.state, "ready", "{:?}", job.error);
    let preview = job.preview.unwrap();
    let request = RestoreRequest {
        confirmation_token: preview.confirmation_token,
        archive_sha256: hash.clone(),
        destination_id: preview.destination_id,
        timestamp_policy: TimestampPolicy::Strict,
    };
    let key = Uuid::new_v4();
    let mut wrong = request.clone();
    wrong.destination_id = Uuid::now_v7();
    assert!(service
        .restore(id, Uuid::new_v4(), wrong)
        .await
        .unwrap_err()
        .to_string()
        .contains("confirmation_mismatch"));
    service.restore(id, key, request.clone()).await.unwrap();
    assert_eq!(terminal(&service, id).await.state, "completed");
    assert_eq!(
        service.restore(id, key, request).await.unwrap().state,
        "completed"
    );
    // Simulate journal loss after successful DB commit; marker must recover completion.
    let jobs = JobStore::new(dir.path().join("jobs")).unwrap();
    let mut job = jobs.get(id).unwrap();
    job.state = "restoring".into();
    job.cancel_requested = true;
    jobs.save(&job).unwrap();
    service.recover().await.unwrap();
    assert_eq!(service.status(id).await.unwrap().state, "completed");
}
#[tokio::test]
async fn interrupted_upload_is_failed_and_cross_instance_lease_is_enforced() {
    let dir = tempfile::tempdir().unwrap();
    let a = service(dir.path()).await;
    let b = service(dir.path()).await;
    let upload = a
        .begin_import(Uuid::new_v4(), &"a".repeat(64))
        .await
        .unwrap()
        .ok()
        .unwrap();
    let id = upload.job.id;
    assert!(b.export(Uuid::new_v4()).await.is_err());
    drop(upload);
    assert_eq!(terminal(&b, id).await.state, "failed");
    let key = Uuid::new_v4();
    let job = b.export(key).await.unwrap();
    assert_eq!(terminal(&b, job.id).await.state, "ready");
    assert_eq!(a.export(key).await.unwrap().id, job.id);
    assert!(a.begin_import(key, &"b".repeat(64)).await.is_err());
    assert!(a.origin_allowed(None));
    assert!(a.origin_allowed(Some("http://localhost:5173")));
    assert!(!a.origin_allowed(Some("https://evil.test")));
}

#[tokio::test]
async fn retention_removes_artifact_without_erasing_idempotent_job() {
    let dir = tempfile::tempdir().unwrap();
    let service = service(dir.path()).await;
    let key = Uuid::new_v4();
    let started = service.export(key).await.unwrap();
    let mut job = terminal(&service, started.id).await;
    assert_eq!(job.state, "ready");
    let jobs = JobStore::new(dir.path().join("jobs")).unwrap();
    job.updated_at = "2000-01-01T00:00:00Z".into();
    jobs.save(&job).unwrap();
    service.recover().await.unwrap();
    assert_eq!(service.status(job.id).await.unwrap().state, "expired");
    assert_eq!(service.export(key).await.unwrap().id, job.id);
    assert!(!dir.path().join("jobs").join(job.id.to_string()).exists());
}
