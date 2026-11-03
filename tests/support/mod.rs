#![allow(dead_code)]
use axum::{body::Body, http::Request, Router};
use beeteam::{
    config::{AppConfig, CorsConfig, McpConfig, DEFAULT_MCP_PATH},
    db::{init_pool, run_migrations},
    repositories::database::DatabaseRepository,
    routes::create_router,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

pub async fn app() -> Router {
    if std::env::var("BEE_TEST_DRIVER").as_deref() == Ok("sqlite") {
        let url = format!(
            "sqlite://{}",
            std::env::temp_dir()
                .join(format!("beeteam-test-{}.sqlite", uuid::Uuid::new_v4()))
                .to_string_lossy()
                .replace('\\', "/")
        );
        let database = DatabaseRepository::connect(beeteam::config::DatabaseDriver::Sqlite, &url)
            .await
            .unwrap();
        let config = AppConfig {
            database_driver: beeteam::config::DatabaseDriver::Sqlite,
            database_url: url,
            host: "127.0.0.1".parse().unwrap(),
            port: 0,
            cors: CorsConfig::Permissive,
            body_limit_bytes: 22 * 1024 * 1024,
            otel_enabled: false,
            mcp: McpConfig {
                enabled: cfg!(feature = "mcp"),
                path: DEFAULT_MCP_PATH.into(),
                cors: CorsConfig::Permissive,
            },
        };
        create_router(AppState::new(database), &config)
    } else {
        app_with_pool().await.0
    }
}
pub async fn app_with_pool() -> (Router, sqlx::PgPool) {
    let url = std::env::var("BEE_TEST_DATABASE_URL")
        .expect("BEE_TEST_DATABASE_URL must point to an isolated PostgreSQL 18 test DB");
    let admin = init_pool(&url).await.unwrap();
    let name = format!("bee_test_{}", uuid::Uuid::new_v4().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
        .execute(&admin)
        .await
        .unwrap();
    let mut test_url = url::Url::parse(&url).unwrap();
    test_url.set_path(&name);
    let pool = init_pool(test_url.as_str()).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let config = AppConfig {
        database_driver: beeteam::config::DatabaseDriver::Postgres,
        database_url: url,
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 22 * 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: cfg!(feature = "mcp"),
            path: DEFAULT_MCP_PATH.into(),
            cors: CorsConfig::Permissive,
        },
    };
    (
        create_router(
            AppState::new(DatabaseRepository::new(pool.clone())),
            &config,
        ),
        pool,
    )
}
pub async fn request(
    app: &Router,
    method: &str,
    path: &str,
    body: Value,
    version: Option<i64>,
) -> (u16, Value) {
    request_key(app, method, path, body, version, uuid::Uuid::new_v4()).await
}
pub async fn request_key(
    app: &Router,
    method: &str,
    path: &str,
    body: Value,
    version: Option<i64>,
    key: uuid::Uuid,
) -> (u16, Value) {
    let mut req = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .header("X-Actor-Kind", "human")
        .header("Idempotency-Key", key.to_string());
    if let Some(v) = version {
        req = req.header("If-Match", format!("\"{v}\""));
    }
    let response = app
        .clone()
        .oneshot(req.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let status = response.status().as_u16();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let value: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    if status != 204 {
        let actual = path.split('?').next().unwrap();
        if let Some(op) = beeteam::dto::contracts::OPERATIONS.iter().find(|op| {
            op.method == method
                && op.path.split('/').count() == actual.split('/').count()
                && op
                    .path
                    .split('/')
                    .zip(actual.split('/'))
                    .all(|(a, b)| a == b || a.starts_with('{'))
        }) {
            let response = beeteam::dto::contracts::resolve(
                &op.document,
                &op.definition["responses"][status.to_string()],
            );
            if let Some(schema) = response.pointer("/content/application~1json/schema") {
                beeteam::dto::contracts::validate_schema(&op.document, schema, &value)
                    .unwrap_or_else(|e| {
                        panic!("{} response violates schema: {e}\n{value}", op.name)
                    });
            }
        }
    }
    (status, value)
}
pub async fn ok(
    app: &Router,
    method: &str,
    path: &str,
    body: Value,
    version: Option<i64>,
) -> Value {
    let (status, value) = request(app, method, path, body, version).await;
    assert!(
        (200..300).contains(&status),
        "{method} {path}: {status} {value}"
    );
    value
}
pub fn id(v: &Value) -> &str {
    v["id"].as_str().unwrap()
}
pub fn ver(v: &Value) -> Option<i64> {
    v["version"].as_i64()
}
pub fn manual() -> Value {
    json!({"mode":"manual","conversationRef":"test","approvalRef":"approval"})
}
pub fn automatic() -> Value {
    json!({"mode":"automatic","conversationRef":"test"})
}
pub async fn get(app: &Router, path: &str) -> Value {
    ok(app, "GET", path, json!({}), None).await
}

pub async fn legacy_replay(
    pool: &sqlx::PgPool,
    operation: &str,
    key: uuid::Uuid,
    hashed_input: Value,
    data: Value,
) {
    use sha2::{Digest, Sha256};
    let hash = Sha256::digest(serde_json::to_vec(&hashed_input).unwrap())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    let repo = beeteam::repositories::resources::ResourceRepository::new(pool.clone());
    let mut unit = repo.begin().await.unwrap();
    unit.save_replay(
        "human:",
        operation,
        key,
        &hash,
        &beeteam::dto::backend::Outcome::data(data),
    )
    .await
    .unwrap();
    unit.commit().await.unwrap();
}

/// Explicit synthetic declaration for test executions; not observed product usage.
pub fn unavailable_usage() -> Value {
    json!({"entries":[{"source":"test-fixture","harness":"test-runner","surface":"integration-test","harnessVersion":null,"sessionId":"unavailable","epoch":"unavailable","evidenceId":uuid::Uuid::new_v4(),"previousEvidenceId":null,"actor":{"kind":"human","id":null},"actorRole":"human","provider":null,"modelId":null,"scope":"session","reportKind":"unavailable","quality":"unavailable","attribution":"unallocated","observedAt":"2026-10-31T00:00:00Z","periodStart":null,"periodEnd":null,"inputTokens":null,"outputTokens":null,"cachedInputTokens":null,"reasoningOutputTokens":null,"discovery":{"reason":"Synthetic integration fixture has no model execution.","attempts":["Inspected fixture: no model invocation or usage source exists."]}}]})
}

/// Synthetic measured session snapshot for isolated tests only; never product usage.
pub fn session_usage(agent: &str) -> Value {
    json!({"entries":[{"source":"test-fixture","harness":"test-runner","surface":"integration-test","harnessVersion":null,"sessionId":uuid::Uuid::new_v4(),"epoch":"fixture-epoch","evidenceId":uuid::Uuid::new_v4(),"previousEvidenceId":null,"actor":{"kind":"agent","id":agent},"actorRole":"collaborator","provider":"openai","modelId":"fixture-model","scope":"session","reportKind":"cumulative_snapshot","quality":"measured","attribution":"unallocated","observedAt":"2026-11-02T00:00:00Z","periodStart":null,"periodEnd":null,"inputTokens":"100","outputTokens":"20","totalTokens":"120","cachedInputTokens":"30","reasoningOutputTokens":"5","discovery":null}]})
}

/// Isolated fixture access for migration/replay compatibility tests only.
pub async fn sqlite_app_with_pool() -> (Router, sqlx::SqlitePool) {
    let url = format!(
        "sqlite://{}",
        std::env::temp_dir()
            .join(format!("bee-legacy-{}.sqlite", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .replace('\\', "/")
    );
    let database = DatabaseRepository::connect(beeteam::config::DatabaseDriver::Sqlite, &url)
        .await
        .unwrap();
    let pool = beeteam::repositories::sqlite::connect(&url).await.unwrap();
    let config = AppConfig {
        database_driver: beeteam::config::DatabaseDriver::Sqlite,
        database_url: url,
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 22 * 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: true,
            path: DEFAULT_MCP_PATH.into(),
            cors: CorsConfig::Permissive,
        },
    };
    (create_router(AppState::new(database), &config), pool)
}

/// Explicit inaccessible fixture root: exercises successful registration without touching product paths.
pub fn test_project_scope() -> Value {
    json!({"projects":[{"key":"fixture","name":"Isolated fixture","rootPath":std::env::temp_dir().join(format!("bee-missing-project-{}",uuid::Uuid::new_v4())).to_string_lossy()}]})
}

pub mod local_git;
