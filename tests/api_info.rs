use axum::{body::Body, http::Request, Router};
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig},
    repositories::database::DatabaseRepository,
    routes::create_router,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

async fn fixture(enabled: bool, host: &str, transfer: Option<bool>) -> Router {
    // Closed lazy pool proves discovery does not depend on database availability.
    let pool = sqlx::postgres::PgPoolOptions::new()
        .connect_lazy("postgres://private:secret@127.0.0.1:1/private")
        .unwrap();
    pool.close().await;
    let database = DatabaseRepository::new(pool);
    let mut state = AppState::new(database.clone());
    let temp = tempfile::tempdir().unwrap();
    if let Some(enabled) = transfer {
        state = state.with_transfers(
            beeteam::services::data_transfer::service::TransferService::new(
                database.transfers(),
                beeteam::services::data_transfer::config::TransferConfig {
                    enabled,
                    directory: temp.path().join("private"),
                    origins: vec!["https://private.invalid".into()],
                    limits: beeteam::repositories::transfer::archive::Limits::default(),
                    retention_seconds: 60,
                },
            )
            .unwrap(),
        );
    }
    let config = AppConfig {
        database_driver: DatabaseDriver::Postgres,
        database_url: "private".into(),
        host: host.parse().unwrap(),
        port: 0,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled,
            path: "/custom-mcp".into(),
            cors: CorsConfig::Permissive,
        },
    };
    create_router(state, &config)
}
async fn read(app: &Router, path: &str) -> (u16, axum::http::HeaderMap, Value) {
    let r = app
        .clone()
        .oneshot(Request::get(path).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = r.status().as_u16();
    let headers = r.headers().clone();
    let bytes = r.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        headers,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
#[tokio::test]
async fn info_is_public_small_and_independent_of_database_and_health() {
    let app = fixture(false, "127.0.0.1", None).await;
    let (status, headers, body) = read(&app, "/api/v1/info").await;
    assert_eq!(status, 200);
    assert_eq!(headers["cache-control"], "no-store");
    assert_eq!(body["apiVersion"], env!("CARGO_PKG_VERSION"));
    assert_eq!(body["supportedContractVersions"], json!(["v1", "v2"]));
    assert_eq!(
        body.as_object().unwrap().keys().collect::<Vec<_>>(),
        vec!["apiVersion", "capabilities", "supportedContractVersions"]
    );
    assert!(!body.to_string().contains("private"));
    assert_eq!(
        read(&app, "/health").await.2,
        json!({"status":"ok","version":env!("CARGO_PKG_VERSION")})
    );
    let schema = read(&app, "/openapi.json").await.2;
    assert_eq!(schema["info"]["title"], "Get Bee Team");
    beeteam::dto::contracts::validate_schema(
        &schema,
        &schema["components"]["schemas"]["ApiInfo"],
        &body,
    )
    .unwrap();
    assert!(schema["paths"]["/api/v1/info"]["get"]["responses"]["200"].is_object());
}

#[tokio::test]
async fn capabilities_follow_compilation_runtime_and_transfer_service_flags() {
    for mcp in [false, true] {
        for (host, local) in [("127.0.0.1", true), ("0.0.0.0", false)] {
            for transfer in [None, Some(false), Some(true)] {
                let app = fixture(mcp, host, transfer).await;
                let (status, _, body) = read(&app, "/api/v1/info").await;
                assert_eq!(status, 200);
                let caps = body["capabilities"].as_array().unwrap();
                assert_eq!(caps.contains(&json!("mcp")), mcp && cfg!(feature = "mcp"));
                assert_eq!(
                    caps.contains(&json!("data-transfer")),
                    transfer == Some(true)
                );
                assert_eq!(caps.contains(&json!("local-projects.open")), local);
                for capability in [
                    "agents.latest-activity",
                    "teams.role-icons",
                    "tasks.execution-intervals",
                    "tasks.timeline-points",
                    "tasks.participants",
                    "tasks.work-scope",
                ] {
                    assert!(caps.contains(&json!(capability)));
                }
                let mut sorted = caps.clone();
                sorted.sort_by_key(Value::to_string);
                sorted.dedup();
                assert_eq!(*caps, sorted);
                assert!(!body.to_string().contains("private"));
            }
        }
    }
}
