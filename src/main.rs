use anyhow::Result;
use beeteam::{
    config::AppConfig, libs::telemetry, repositories::database::DatabaseRepository,
    routes::create_router, state::AppState,
};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = AppConfig::from_env()?;
    let _telemetry = telemetry::init_tracing(config.otel_enabled)?;
    let database =
        DatabaseRepository::connect(config.database_driver, &config.database_url).await?;
    let state = AppState::new(database);

    let router = create_router(state, &config);

    let addr = config.listen_addr()?;
    let listener = TcpListener::bind(addr).await?;
    tracing::info!("listening on {}", addr);
    if let Some(mcp_url) = config.mcp_endpoint_url() {
        tracing::info!("mcp enabled at {}", mcp_url);
    }

    axum::serve(listener, router).await?;
    Ok(())
}
