mod support;
use axum::{body::Body, extract::ConnectInfo, http::Request};
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig},
    dto::{backend::Failure, local_projects::ProjectApplication},
    repositories::{
        contracts::{ProjectOpener, RepositoryFuture},
        database::DatabaseRepository,
        local_git::LocalGitDiscovery,
    },
    routes::create_router,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use support::{get, id, manual, ok};
use tower::ServiceExt;

#[derive(Default)]
struct Opener {
    calls: Mutex<Vec<(String, ProjectApplication)>>,
    fail: Mutex<bool>,
}
impl ProjectOpener for Opener {
    fn open<'a>(&'a self, root: &'a str, app: ProjectApplication) -> RepositoryFuture<'a, ()> {
        Box::pin(async move {
            self.calls.lock().unwrap().push((root.to_owned(), app));
            if *self.fail.lock().unwrap() {
                Err(Failure::new(
                    "local_application_unavailable",
                    "VS Code indisponível.",
                ))
            } else {
                Ok(())
            }
        })
    }
}
async fn fixture() -> (axum::Router, Value, Arc<Opener>, tempfile::TempDir) {
    let temp = tempfile::tempdir().unwrap();
    let url = format!(
        "sqlite://{}",
        temp.path()
            .join("test.sqlite")
            .to_string_lossy()
            .replace('\\', "/")
    );
    let db = DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
        .await
        .unwrap();
    let opener = Arc::new(Opener::default());
    let config = AppConfig {
        database_url: url,
        database_driver: DatabaseDriver::Sqlite,
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: false,
            path: "/mcp".into(),
            cors: CorsConfig::Permissive,
        },
    };
    let app = create_router(
        AppState::with_project_adapters(db, Arc::new(LocalGitDiscovery::default()), opener.clone()),
        &config,
    );
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Local action test"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Local action test","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Local action test","teamId":id(&team)}),
        None,
    )
    .await;
    let task = ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Local action test","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual(),"workScope":{"projects":[{"key":"app","name":"Test","rootPath":temp.path().to_str().unwrap()}]}}),None).await;
    (app, task, opener, temp)
}
async fn local_request(app: &axum::Router, method: &str, path: &str, input: Value) -> (u16, Value) {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header("host", "127.0.0.1:59865")
        .header("origin", "http://127.0.0.1:5176")
        .header("x-bee-local-action", "open-project")
        .header("content-type", "application/json")
        .body(Body::from(input.to_string()))
        .unwrap();
    request.extensions_mut().insert(ConnectInfo(
        "127.0.0.1:12345".parse::<SocketAddr>().unwrap(),
    ));
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status().as_u16();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn rejects_remote_origins_and_requires_explicit_local_action_before_lookup() {
    let app = support::app().await;
    for (peer, origin, header) in [
        ("192.0.2.1:1000", "http://localhost:5173", true),
        ("127.0.0.1:1000", "https://attacker.example", true),
        ("127.0.0.1:1000", "null", true),
        ("127.0.0.1:1000", "http://localhost:5173", false),
    ] {
        let mut request = Request::post(format!(
            "/api/v1/tasks/{}/projects/app/open",
            uuid::Uuid::now_v7()
        ))
        .header("host", "127.0.0.1:59865")
        .header("origin", origin)
        .header("content-type", "application/json");
        if header {
            request = request.header("x-bee-local-action", "open-project");
        }
        let mut request = request
            .body(Body::from(r#"{"application":"explorer"}"#))
            .unwrap();
        request
            .extensions_mut()
            .insert(ConnectInfo(peer.parse::<SocketAddr>().unwrap()));
        let response = app.clone().oneshot(request).await.unwrap();
        assert_eq!(
            response.status(),
            403,
            "peer={peer}, origin={origin}, explicit={header}"
        );
    }
}

#[tokio::test]
async fn resolves_only_registered_project_and_does_not_mutate_task() {
    let (app, task, opener, temp) = fixture().await;
    let path = format!("/api/v1/tasks/{}/projects/app/open", id(&task));
    assert_eq!(local_request(&app, "GET", &path, Value::Null).await.0, 405);
    assert!(opener.calls.lock().unwrap().is_empty());
    let (status, response) =
        local_request(&app, "POST", &path, json!({"application":"vscode"})).await;
    assert_eq!(status, 202, "{response}");
    assert_eq!(
        response,
        json!({"projectKey":"app","application":"vscode","outcome":"requested"})
    );
    let contract = get(&app, "/openapi/local-projects.json").await;
    beeteam::dto::contracts::validate_schema(
        &contract,
        &contract["components"]["schemas"]["OpenProjectResponse"],
        &response,
    )
    .unwrap();
    assert_eq!(
        opener.calls.lock().unwrap().as_slice(),
        &[(
            temp.path().to_str().unwrap().to_owned(),
            ProjectApplication::Vscode
        )]
    );
    let after = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    assert_eq!(after, task);
    let missing = path.replace("/app/", "/missing/");
    assert_eq!(
        local_request(&app, "POST", &missing, json!({"application":"explorer"}))
            .await
            .0,
        404
    );
    for input in [
        json!({"application":"powershell"}),
        json!({"application":"explorer","path":"C:/other"}),
        json!({"application":"explorer","command":"cmd"}),
    ] {
        let (status, error) = local_request(&app, "POST", &path, input).await;
        assert_eq!(status, 422);
        assert_eq!(error["code"], "invalid_request");
        assert!(error["error"].is_string());
    }
    assert_eq!(opener.calls.lock().unwrap().len(), 1);
    *opener.fail.lock().unwrap() = true;
    let (status, error) = local_request(&app, "POST", &path, json!({"application":"vscode"})).await;
    assert_eq!(status, 503);
    assert_eq!(error["code"], "local_application_unavailable");
    let unknown_task = format!("/api/v1/tasks/{}/projects/app/open", uuid::Uuid::now_v7());
    assert_eq!(
        local_request(
            &app,
            "POST",
            &unknown_task,
            json!({"application":"explorer"})
        )
        .await
        .0,
        404
    );
    assert_eq!(opener.calls.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn real_loopback_transport_supplies_peer_information_without_opening_windows() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let (app, task, opener, _temp) = fixture().await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    let mut stream = tokio::net::TcpStream::connect(address).await.unwrap();
    let body = r#"{"application":"explorer"}"#;
    let request = format!("POST /api/v1/tasks/{}/projects/app/open HTTP/1.1\r\nHost: {address}\r\nOrigin: http://127.0.0.1:5176\r\nX-Bee-Local-Action: open-project\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",id(&task),body.len());
    stream.write_all(request.as_bytes()).await.unwrap();
    let mut response = Vec::new();
    tokio::time::timeout(
        std::time::Duration::from_secs(3),
        stream.read_to_end(&mut response),
    )
    .await
    .unwrap()
    .unwrap();
    server.abort();
    assert!(
        String::from_utf8_lossy(&response).starts_with("HTTP/1.1 202"),
        "{}",
        String::from_utf8_lossy(&response)
    );
    assert_eq!(opener.calls.lock().unwrap().len(), 1);
}
