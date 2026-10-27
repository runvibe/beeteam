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
    create_router(AppState::new(DatabaseRepository::new(pool)), &config)
}
pub async fn request(
    app: &Router,
    method: &str,
    path: &str,
    body: Value,
    version: Option<i64>,
) -> (u16, Value) {
    let mut req = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .header("X-Actor-Kind", "human")
        .header("Idempotency-Key", uuid::Uuid::new_v4().to_string());
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
