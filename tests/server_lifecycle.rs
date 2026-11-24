use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig},
    server,
    services::frontend::FrontendMode,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::test]
async fn prepared_server_serves_health_and_stops_on_shutdown() {
    let dir = tempfile::tempdir().unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let config = AppConfig {
        database_driver: DatabaseDriver::Sqlite,
        database_url: format!("sqlite://{}", dir.path().join("bee.sql").display()),
        host: "127.0.0.1".parse().unwrap(),
        port,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: false,
            path: "/mcp".into(),
            cors: CorsConfig::Permissive,
        },
    };
    let prepared = server::prepare(config, FrontendMode::Disabled, listener)
        .await
        .unwrap();
    assert_eq!(prepared.local_addr().port(), port);
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    let task = tokio::spawn(prepared.serve(async {
        let _ = rx.await;
    }));

    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
        .await
        .unwrap();
    stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .await
        .unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    assert!(response.starts_with("HTTP/1.1 200"), "{response}");

    tx.send(()).unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), task)
        .await
        .expect("server must stop after shutdown")
        .unwrap()
        .unwrap();
    assert!(tokio::net::TcpStream::connect(("127.0.0.1", port))
        .await
        .is_err());
}

#[tokio::test]
async fn shutdown_ends_open_event_streams_promptly() {
    let dir = tempfile::tempdir().unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let config = AppConfig {
        database_driver: DatabaseDriver::Sqlite,
        database_url: format!("sqlite://{}", dir.path().join("bee.sql").display()),
        host: "127.0.0.1".parse().unwrap(),
        port,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: false,
            path: "/mcp".into(),
            cors: CorsConfig::Permissive,
        },
    };
    let prepared = server::prepare(config, FrontendMode::Disabled, listener)
        .await
        .unwrap();
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    let task = tokio::spawn(prepared.serve(async {
        let _ = rx.await;
    }));

    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
        .await
        .unwrap();
    stream
        .write_all(b"GET /api/v1/changes HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
        .await
        .unwrap();
    let mut first = [0u8; 256];
    let n = stream.read(&mut first).await.unwrap();
    assert!(String::from_utf8_lossy(&first[..n]).contains("text/event-stream"));

    tx.send(()).unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(2), task)
        .await
        .expect("open event streams must not delay shutdown")
        .unwrap()
        .unwrap();
}
