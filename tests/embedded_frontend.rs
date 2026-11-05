#![cfg(feature = "embedded-ui")]
use axum::{body::Body, http::Request};
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig},
    repositories::database::DatabaseRepository,
    state::AppState,
};
use http_body_util::BodyExt;
use tower::ServiceExt;
fn app() -> axum::Router {
    app_with_mode(beeteam::services::frontend::FrontendMode::Embedded)
}
fn app_with_mode(mode: beeteam::services::frontend::FrontendMode) -> axum::Router {
    let pool = sqlx::postgres::PgPoolOptions::new()
        .connect_lazy("postgres://unused:unused@127.0.0.1:1/unused")
        .unwrap();
    let config = AppConfig {
        database_driver: DatabaseDriver::Postgres,
        database_url: String::new(),
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: cfg!(feature = "mcp"),
            path: "/tasks/mcp".into(),
            cors: CorsConfig::Permissive,
        },
    };
    beeteam::routes::create_router_with_frontend(
        AppState::new(DatabaseRepository::new(pool)),
        &config,
        mode,
    )
}
#[tokio::test]
async fn deep_links_get_html_but_missing_assets_and_reserved_routes_do_not() {
    let app = app();
    for path in [
        "/",
        "/app/",
        "/guide/",
        "/guide/reference/mcp/tools",
        "/guide/first-team?harness=codex",
        "/app/tasks/task-alias",
        "/app/boards/example/settings",
        "/boards",
        "/boards/example/settings",
        "/tasks/task-alias",
        "/agents/agent/settings",
        "/teams/team/settings?from=/boards",
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), 200, "{path}");
        assert!(response.headers()["content-type"]
            .to_str()
            .unwrap()
            .starts_with("text/html"));
        assert_eq!(response.headers()["cache-control"], "no-cache");
    }
    for path in [
        "/api/v1/unknown",
        "/assets/missing.js",
        "/guide/missing.js",
        "/app/assets/missing.js",
        "/missing.png",
        "/boards/missing.js",
        "/tasks/mcp/unknown",
        "/unknown",
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_ne!(response.status(), 200, "{path}");
        assert!(
            !response
                .headers()
                .get("content-type")
                .is_some_and(|v| v.to_str().unwrap_or("").starts_with("text/html")),
            "{path}"
        );
    }
}
#[tokio::test]
async fn assets_have_mime_etag_cache_and_head_semantics() {
    let app = app();
    let response = app
        .clone()
        .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap();
    let html = String::from_utf8(
        response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes()
            .to_vec(),
    )
    .unwrap();
    let asset = html
        .split("src=\"")
        .filter_map(|s| s.split('"').next())
        .find(|s| s.starts_with("/assets/"))
        .unwrap();
    let response = app
        .clone()
        .oneshot(Request::builder().uri(asset).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert!(response.headers()["content-type"]
        .to_str()
        .unwrap()
        .contains("javascript"));
    assert!(response.headers()["cache-control"]
        .to_str()
        .unwrap()
        .contains("immutable"));
    let etag = response.headers()["etag"].clone();
    let length = response.headers()["content-length"].clone();
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("HEAD")
                .uri(asset)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.headers()["content-length"], length);
    assert!(response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes()
        .is_empty());
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(asset)
                .header("if-none-match", etag)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 304);
    assert!(response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes()
        .is_empty());
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/boards")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 405);
}

#[tokio::test]
async fn embedded_serving_can_be_disabled_and_public_assets_revalidate() {
    let disabled = app_with_mode(beeteam::services::frontend::FrontendMode::Disabled);
    let response = disabled
        .oneshot(
            Request::builder()
                .uri("/boards")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 404);
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/theme-init.js")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-cache");
    assert_eq!(response.headers()["x-content-type-options"], "nosniff");
}

#[tokio::test]
async fn css_and_fonts_keep_mime_and_build_manifest_is_private() {
    for (extension, mime) in [
        (".css", "text/css; charset=utf-8"),
        (".woff2", "font/woff2"),
    ] {
        let asset = beeteam::repositories::frontend::ASSETS
            .iter()
            .find(|a| a.path.ends_with(extension))
            .unwrap();
        let response = app()
            .oneshot(
                Request::builder()
                    .uri(asset.path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        assert_eq!(response.headers()["content-type"], mime);
    }
    let response = app()
        .oneshot(
            Request::builder()
                .uri("/.beeteam-build.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 404);
}
