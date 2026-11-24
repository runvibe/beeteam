use anyhow::Result;
use beeteam::{config::AppConfig, libs::telemetry, server};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = AppConfig::from_env()?;
    let frontend_mode = beeteam::services::frontend::FrontendMode::from_env()?;
    let _telemetry = telemetry::init_tracing(config.otel_enabled)?;
    let listener = TcpListener::bind(config.listen_addr()?).await?;
    server::prepare(config, frontend_mode, listener)
        .await?
        .serve(std::future::pending())
        .await
}
