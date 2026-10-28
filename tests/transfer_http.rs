use axum::{body::Body, http::Request, Router};
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig, DEFAULT_MCP_PATH},
    repositories::{database::DatabaseRepository, transfer::archive::Limits},
    services::data_transfer::{config::TransferConfig, service::TransferService},
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;
async fn app(dir: &std::path::Path) -> Router {
    app_with_timeout(dir, 1800).await
}
async fn app_with_timeout(dir: &std::path::Path, seconds: u64) -> Router {
    let url = format!("sqlite://{}", dir.join("db.sqlite").display());
    let db = DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
        .await
        .unwrap();
    let service = TransferService::new(
        db.transfers(),
        TransferConfig {
            enabled: true,
            directory: dir.join("files"),
            origins: vec!["http://localhost:5173".into()],
            limits: Limits {
                seconds,
                ..Limits::default()
            },
            retention_seconds: 86400,
        },
    )
    .unwrap();
    let state = AppState::new(db).with_transfers(service);
    beeteam::routes::create_router(
        state,
        &AppConfig {
            database_driver: DatabaseDriver::Sqlite,
            database_url: url,
            host: "127.0.0.1".parse().unwrap(),
            port: 0,
            cors: CorsConfig::Permissive,
            body_limit_bytes: 1024,
            otel_enabled: false,
            mcp: McpConfig {
                enabled: cfg!(feature = "mcp"),
                path: DEFAULT_MCP_PATH.into(),
                cors: CorsConfig::Permissive,
            },
        },
    )
}
async fn request(
    app: &Router,
    path: &str,
    origin: Option<&str>,
    body: Option<Value>,
    key: Uuid,
) -> (u16, Value) {
    let mut request = Request::builder()
        .method(if body.is_some() { "POST" } else { "GET" })
        .uri(path)
        .header("content-type", "application/json")
        .header("x-actor-kind", "human")
        .header("idempotency-key", key.to_string());
    if let Some(origin) = origin {
        request = request.header("origin", origin);
    }
    if path == "/mcp" {
        request = request
            .header("host", "127.0.0.1")
            .header("accept", "application/json, text/event-stream")
            .header("mcp-protocol-version", "2025-11-25");
    }
    let response = app
        .clone()
        .oneshot(
            request
                .body(
                    body.map(|b| Body::from(b.to_string()))
                        .unwrap_or(Body::empty()),
                )
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
#[tokio::test]
async fn origin_is_rejected_on_actual_request_and_export_key_is_stable() {
    let dir = tempfile::tempdir().unwrap();
    let app = app(dir.path()).await;
    let key = Uuid::new_v4();
    let (status, error) = request(
        &app,
        "/api/v1/data-transfers/exports",
        Some("https://evil.test"),
        Some(json!({})),
        key,
    )
    .await;
    assert_eq!(status, 403);
    assert_eq!(error["code"], "origin_forbidden");
    let (status, job) = request(
        &app,
        "/api/v1/data-transfers/exports",
        Some("http://localhost:5173"),
        Some(json!({})),
        key,
    )
    .await;
    assert_eq!(status, 202);
    let (_, retry) = request(
        &app,
        "/api/v1/data-transfers/exports",
        None,
        Some(json!({})),
        key,
    )
    .await;
    assert_eq!(retry["id"], job["id"]);
    let path = format!(
        "/api/v1/data-transfers/jobs/{}",
        job["id"].as_str().unwrap()
    );
    for _ in 0..100 {
        let (_, job) = request(&app, &path, None, None, key).await;
        if job["state"] == "ready" {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    panic!("export not ready");
}
#[cfg(feature = "mcp")]
#[tokio::test]
async fn mcp_and_http_share_job_and_origin_enforcement() {
    let dir = tempfile::tempdir().unwrap();
    let app = app(dir.path()).await;
    let key = Uuid::new_v4();
    let body = json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"exportData","arguments":{"idempotencyKey":key}}});
    assert_eq!(
        request(
            &app,
            "/mcp",
            Some("https://evil.test"),
            Some(body.clone()),
            key
        )
        .await
        .0,
        403
    );
    let (status, result) = request(&app, "/mcp", None, Some(body), key).await;
    assert_eq!(status, 200);
    assert_eq!(result["result"]["isError"], false, "{result}");
    let (_, job) = request(
        &app,
        "/api/v1/data-transfers/exports",
        None,
        Some(json!({})),
        key,
    )
    .await;
    assert_eq!(job["id"], result["result"]["structuredContent"]["id"]);
}

#[tokio::test]
async fn stalled_upload_expires_and_releases_heavy_lease() {
    let dir = tempfile::tempdir().unwrap();
    let app = app_with_timeout(dir.path(), 2).await;
    let stream =
        futures_util::stream::pending::<std::result::Result<bytes::Bytes, std::io::Error>>();
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/data-transfers/imports")
        .header("content-type", "multipart/form-data; boundary=paused")
        .header("idempotency-key", Uuid::new_v4().to_string())
        .header("x-archive-sha256", "a".repeat(64))
        .body(Body::from_stream(stream))
        .unwrap();
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        app.clone().oneshot(request),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(response.status(), 400);
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let error: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(error["code"], "transfer_timeout");
    for _ in 0..100 {
        let (status, _) = self::request(
            &app,
            "/api/v1/data-transfers/exports",
            None,
            Some(json!({})),
            Uuid::new_v4(),
        )
        .await;
        if status == 202 {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    panic!("lease still held after stalled upload timeout");
}

#[tokio::test]
async fn multipart_upload_exceeds_normal_body_limit_then_restores_through_http() {
    let dir = tempfile::tempdir().unwrap();
    let app = app(dir.path()).await;
    let store = beeteam::repositories::transfer::archive::ArchiveStore::new(
        dir.path().join("fixture"),
        Limits::default(),
    )
    .unwrap();
    let archive = Uuid::now_v7();
    store.create_stage(archive).unwrap();
    store.seal(archive, "sqlite", 0).unwrap();
    let bytes = std::fs::read(store.archive_path(archive)).unwrap();
    assert!(bytes.len() > 1024);
    let mut body=b"--fixture\r\nContent-Disposition: form-data; name=\"file\"; filename=\"backup.beeteam.zip\"\r\nContent-Type: application/zip\r\n\r\n".to_vec();
    body.extend(bytes);
    body.extend(b"\r\n--fixture--\r\n");
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/data-transfers/imports")
        .header("content-type", "multipart/form-data; boundary=fixture")
        .header("idempotency-key", Uuid::new_v4().to_string())
        .header("x-archive-sha256", store.digest(archive).unwrap())
        .body(Body::from(body))
        .unwrap();
    let response = app.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), 202);
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let job: Value = serde_json::from_slice(&bytes).unwrap();
    let id = job["id"].as_str().unwrap();
    let path = format!("/api/v1/data-transfers/jobs/{id}");
    let key = Uuid::new_v4();
    let mut preview = Value::Null;
    for _ in 0..100 {
        let (_, job) = self::request(&app, &path, None, None, key).await;
        if job["state"] == "ready" {
            preview = job["preview"].clone();
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    assert!(!preview.is_null());
    let confirmation = json!({"confirmationToken":preview["confirmationToken"],"destinationId":preview["destinationId"],"archiveSha256":preview["archiveSha256"]});
    let (status, _) = self::request(
        &app,
        &format!("/api/v1/data-transfers/imports/{id}/restore"),
        None,
        Some(confirmation.clone()),
        key,
    )
    .await;
    assert_eq!(status, 202);
    for _ in 0..100 {
        let (_, job) = self::request(&app, &path, None, None, key).await;
        if job["state"] == "completed" {
            let (_, retry) = self::request(
                &app,
                &format!("/api/v1/data-transfers/imports/{id}/restore"),
                None,
                Some(confirmation),
                key,
            )
            .await;
            assert_eq!(retry["state"], "completed");
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    panic!("restore did not complete");
}

#[tokio::test]
async fn restored_database_reopens_and_serves_domain_http_and_mcp() {
    let source_dir = tempfile::tempdir().unwrap();
    let source_app = app(source_dir.path()).await;
    let key = Uuid::new_v4();
    let (status, agent) = request(
        &source_app,
        "/api/v1/agents",
        None,
        Some(json!({"name":"Portable agent"})),
        key,
    )
    .await;
    assert_eq!(status, 201, "{agent}");
    let source = DatabaseRepository::connect(
        DatabaseDriver::Sqlite,
        &format!("sqlite://{}", source_dir.path().join("db.sqlite").display()),
    )
    .await
    .unwrap();
    let store = std::sync::Arc::new(
        beeteam::repositories::transfer::archive::ArchiveStore::new(
            source_dir.path().join("archive"),
            Limits::default(),
        )
        .unwrap(),
    );
    let id = Uuid::now_v7();
    let manifest = source.transfers().export(store.clone(), id).await.unwrap();
    let dest_dir = tempfile::tempdir().unwrap();
    let url = format!("sqlite://{}", dest_dir.path().join("db.sqlite").display());
    let dest = DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
        .await
        .unwrap();
    let target = dest.transfers().destination().await.unwrap();
    dest.transfers()
        .restore(
            store.clone(),
            id,
            manifest,
            target.id,
            beeteam::dto::data_transfer::TimestampPolicy::Strict,
            store.digest(id).unwrap(),
        )
        .await
        .unwrap();
    drop(dest);
    let reopened = app(dest_dir.path()).await;
    let (status, restored) = request(
        &reopened,
        &format!("/api/v1/agents/{}", agent["id"].as_str().unwrap()),
        None,
        None,
        key,
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(restored, agent);
    #[cfg(feature = "mcp")]
    {
        let(_,result)=request(&reopened,"/mcp",None,Some(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getAgent","arguments":{"params":{"agentId":agent["id"]}}}})),key).await;
        assert_eq!(result["result"]["isError"], false, "{result}");
        assert_eq!(result["result"]["structuredContent"]["data"], agent);
    }
}
