#![allow(dead_code)]
use super::support::*;
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig},
    dto::session_delivery::SessionDestination,
    repositories::{database::DatabaseRepository, integrated_provider::*},
    routes::create_router,
    state::AppState,
};
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    Arc,
};
use tokio::sync::mpsc;
use uuid::Uuid;
pub const TEST_PNG: &[u8] = b"\x89PNG\r\n\x1a\nbee";
pub const TEST_PDF: &[u8] = b"%PDF-1.4\n% bee test\n%%EOF\n";
pub struct TestProvider(pub AtomicUsize, pub AtomicBool, pub AtomicUsize);
impl IntegratedProvider for TestProvider {
    fn default_workspace(
        &self,
        agent: Uuid,
    ) -> Result<String, beeteam::dto::session_delivery::SessionFailure> {
        let path = std::env::temp_dir()
            .join("beeteam-test-workspaces")
            .join(agent.to_string());
        std::fs::create_dir_all(&path).unwrap();
        Ok(path.to_str().unwrap().into())
    }

    fn create<'a>(&'a self, _root: &'a str, _profile: &'a Value, _: ToolSource, _: Option<beeteam::dto::access_mode::AccessMode>) -> ProviderFuture<'a, String> {
        Box::pin(async move {
            self.0.fetch_add(1, Ordering::SeqCst);
            if self.1.swap(false, Ordering::SeqCst) {
                return Err(beeteam::dto::session_delivery::SessionFailure::new(
                    "needs_auth",
                    "Sign in first",
                    false,
                ));
            }
            Ok(Uuid::new_v4().to_string())
        })
    }
    fn reconcile<'a>(
        &'a self,
        target: &'a SessionDestination,
        _turn: &'a str,
        _profile: &'a Value,
    ) -> ProviderFuture<'a, ReconciledTurn> {
        Box::pin(async move {
            let path = std::path::Path::new(&target.project_root).join("output/example.pdf");
            Ok(ReconciledTurn {
                status: ReconciledStatus::Completed,
                text: Some(format!("Recovered: :codex-file-citation{{path=\"{}\" purpose=\"output\"}}", path.display())),
            })
        })
    }
    fn inspect<'a>(
        &'a self,
        _target: &'a SessionDestination,
        _profile: &'a Value,
        _: ToolSource,
    ) -> ProviderFuture<'a, Value> {
        Box::pin(async {
            Ok(
                json!({"readiness":"ready","tools":{"webSearch":"disabled","networkAccess":false,"skills":[],"mcpServers":[]}}),
            )
        })
    }
    fn run<'a>(
        &'a self,
        target: &'a SessionDestination,
        text: &'a str,
        guidance: &'a str,
        profile: &'a Value,
        tools: ToolSource,
        access: Option<beeteam::dto::access_mode::AccessMode>,
        events: mpsc::Sender<IntegratedEvent>,
        mut controls: mpsc::Receiver<Control>,
    ) -> ProviderFuture<'a, ()> {
        Box::pin(async move {
            self.2.fetch_add(1, Ordering::SeqCst);
            assert!(std::path::Path::new(&target.project_root).is_dir());
            assert!(target.project_root.contains("beeteam-test-workspaces"));
            let text = text.rsplit("\nUser message:\n").next().unwrap_or(text);
            if text == "team-chat-tools" {
                assert_eq!(tools, ToolSource::TeamChat);
            }
            if text == "team-chat-defaults" {
                assert_eq!(tools, ToolSource::TeamChat);
                assert_eq!(profile, &json!({"webSearch":"live","networkAccess":true,"enabledMcpServers":[],"skillRoots":[]}));
            }
            if text == "worker-tools" {
                assert_eq!(tools, ToolSource::Configured);
            }
            if text == "config-error" {
                return Err(beeteam::dto::session_delivery::SessionFailure::new(
                    "codex_config_invalid",
                    "Cannot read configuration",
                    false,
                ));
            }
            if text == "chat-tools-error" {
                return Err(beeteam::dto::session_delivery::SessionFailure::new(
                    "chat_tools_config_invalid",
                    "Invalid chat tools configuration",
                    false,
                ));
            }
            if text == "access-mode-test" {
                assert_eq!(access, Some(beeteam::dto::access_mode::AccessMode::ReadOnly));
            }
            if text == "legacy-access-test" {
                assert_eq!(access, None);
            }
            if text == "explicit-standard" {
                assert_eq!(access, Some(beeteam::dto::access_mode::AccessMode::Standard));
            }
            events
                .send(IntegratedEvent::Accepted("test-turn".into()))
                .await
                .unwrap();
            if text == "show-guidance" {
                events.send(IntegratedEvent::Text(guidance.into())).await.unwrap();
                events.send(IntegratedEvent::Completed).await.unwrap();
                return Ok(());
            }
            if text == "uncertain-access-test" {
                assert_eq!(access, Some(beeteam::dto::access_mode::AccessMode::ReadOnly));
                return Err(beeteam::dto::session_delivery::SessionFailure::new(
                    "provider_io",
                    "Outcome unknown",
                    true,
                ));
            }
            if text == "approve" || text == "decline" {
                let aid = Uuid::now_v7();
                events
                    .send(IntegratedEvent::Approval {
                        approval_id: aid,
                        kind: "network".into(),
                        title: "Test".into(),
                        description: "Isolated test".into(),
                        command: None,
                        host: Some("example.test".into()),
                        paths: vec![],
                    })
                    .await
                    .unwrap();
                match controls.recv().await {
                    Some(Control::Decision {
                        approval_id,
                        accept,
                    }) => {
                        assert_eq!(approval_id, aid);
                        assert_eq!(accept, text == "approve")
                    }
                    _ => panic!("missing approval"),
                }
            }
            if text == "hold" {
                assert!(matches!(controls.recv().await, Some(Control::Cancel)));
                events.send(IntegratedEvent::Cancelled).await.unwrap();
                return Ok(());
            }
            if text == "think" {
                for summary in ["**Plan** steps", "**Plan** steps\n\nRaw-free summary"] {
                    events
                        .send(IntegratedEvent::Reasoning(summary.into()))
                        .await
                        .unwrap();
                }
            }
            if text == "draw" {
                for _ in 0..2 {
                    events
                        .send(IntegratedEvent::Image {
                            item_id: "image-item".into(),
                            media_type: "image/png".into(),
                            bytes: TEST_PNG.to_vec(),
                            revised_prompt: Some("Robot bees".into()),
                        })
                        .await
                        .unwrap();
                }
            }
            if text == "create-file" || text == "legacy-file" || text == "fake-pdf" || text == "uncertain-file" {
                let path = std::path::Path::new(&target.project_root)
                    .join("output")
                    .join("example.pdf");
                std::fs::create_dir_all(path.parent().unwrap()).unwrap();
                if text != "legacy-file" {
                    std::fs::write(
                        &path,
                        if text == "fake-pdf" {
                            b"<html>not a pdf".as_slice()
                        } else {
                            TEST_PDF
                        },
                    )
                    .unwrap();
                }
                events
                    .send(IntegratedEvent::Text(format!(
                        "Here is the file:\n\n:codex-file-citation{{path=\"{}\" purpose=\"output\"}}",
                        path.display()
                    )))
                    .await
                    .unwrap();
                if text == "uncertain-file" {
                    return Err(beeteam::dto::session_delivery::SessionFailure::new("outcome_unknown", "Outcome unknown", true));
                }
                events.send(IntegratedEvent::Completed).await.unwrap();
                return Ok(());
            }
            events
                .send(IntegratedEvent::Text("Res".into()))
                .await
                .unwrap();
            events
                .send(IntegratedEvent::Text("Response".into()))
                .await
                .unwrap();
            events.send(IntegratedEvent::Completed).await.unwrap();
            Ok(())
        })
    }
}
pub async fn test_local_peer(
    mut request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    request.extensions_mut().insert(axum::extract::ConnectInfo(
        "127.0.0.1:40000".parse::<std::net::SocketAddr>().unwrap(),
    ));
    if !request.headers().contains_key("host") {
        request
            .headers_mut()
            .insert("host", "127.0.0.1".parse().unwrap());
    }
    next.run(request).await
}
pub async fn fixture() -> (axum::Router, Value, Value, Arc<TestProvider>) {
    fixture_with_origins(CorsConfig::Permissive, CorsConfig::Permissive).await
}
pub async fn fixture_with_origins(
    api_origins: CorsConfig,
    mcp_origins: CorsConfig,
) -> (axum::Router, Value, Value, Arc<TestProvider>) {
    let (app, agent, team, provider, _) = fixture_with_repo(api_origins, mcp_origins).await;
    (app, agent, team, provider)
}
pub async fn fixture_with_repo(
    api_origins: CorsConfig,
    mcp_origins: CorsConfig,
) -> (
    axum::Router,
    Value,
    Value,
    Arc<TestProvider>,
    DatabaseRepository,
) {
    let temp = std::env::temp_dir().join(format!("beeteam-chat-test-{}.sql", Uuid::new_v4()));
    let url = format!("sqlite://{}", temp.to_string_lossy().replace('\\', "/"));
    let db = if std::env::var("BEE_TEST_DRIVER").as_deref() == Ok("postgres") {
        let (_, pool) = super::support::app_with_pool().await;
        DatabaseRepository::new(pool)
    } else {
        DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
            .await
            .unwrap()
    };
    let provider = Arc::new(TestProvider(AtomicUsize::new(0), AtomicBool::new(false), AtomicUsize::new(0)));
    let state =
        AppState::new(db.clone()).with_leader_chat_provider(provider.clone(), "isolated".into());
    let config = AppConfig {
        database_driver: DatabaseDriver::Sqlite,
        database_url: url,
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: api_origins,
        body_limit_bytes: 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: cfg!(feature = "mcp"),
            path: "/mcp".into(),
            cors: mcp_origins,
        },
    };
    let app = create_router(state, &config).layer(axum::middleware::from_fn(test_local_peer));
    let agent = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Chat leader"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"Chat team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let agent = get(&app, &format!("/api/v2/agents/{}", id(&agent))).await;
    (app, agent, team, provider, db)
}
pub async fn configured() -> (axum::Router, Value, Value, Arc<TestProvider>) {
    let (app, a, t, p) = fixture().await;
    let cfg = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    let r = request_key(
        &app,
        "PUT",
        &format!("/api/v2/agents/{}/execution-config", id(&a)),
        cfg,
        ver(&a),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(r.0, 200, "{r:?}");
    (app, a, t, p)
}
pub async fn wait_state(app: &axum::Router, r: &Value, state: &str) -> Value {
    for _ in 0..150 {
        let v = get(app, &format!("/api/v2/agent-requests/{}", id(r))).await;
        if v["request"]["state"] == state {
            return v;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    panic!("State {state} not reached")
}
