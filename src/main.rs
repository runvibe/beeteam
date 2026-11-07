use anyhow::Result;
use beeteam::{
    config::AppConfig, libs::telemetry, repositories::database::DatabaseRepository,
    routes::create_router_with_frontend, state::AppState,
};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = AppConfig::from_env()?;
    let frontend_mode = beeteam::services::frontend::FrontendMode::from_env()?;
    let _telemetry = telemetry::init_tracing(config.otel_enabled)?;
    let database =
        DatabaseRepository::connect(config.database_driver, &config.database_url).await?;
    let transfer_config = beeteam::services::data_transfer::config::TransferConfig::from_env()?;
    let transfer = if transfer_config.enabled {
        Some(
            beeteam::services::data_transfer::service::TransferService::new(
                database.transfers(),
                transfer_config,
            )?,
        )
    } else {
        None
    };
    let mut state = AppState::new(database);
    if let Some(transfer) = transfer {
        if transfer.recover().await.is_err() {
            tracing::warn!("transfer recovery pending; background maintenance will retry");
        }
        let maintenance = transfer.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            loop {
                interval.tick().await;
                if maintenance.recover().await.is_err() {
                    tracing::warn!("transfer maintenance will retry");
                }
            }
        });
        state = state.with_transfers(transfer);
    }

    let addr = config.listen_addr()?;
    let listener = TcpListener::bind(addr).await?;
    let actual = listener.local_addr()?;
    let ip = match actual.ip() {
        std::net::IpAddr::V4(ip) if ip.is_unspecified() => {
            std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST)
        }
        std::net::IpAddr::V6(ip) if ip.is_unspecified() => {
            std::net::IpAddr::V6(std::net::Ipv6Addr::LOCALHOST)
        }
        other => other,
    };
    let endpoint = config.mcp.enabled.then(|| {
        format!(
            "http://{}{}",
            std::net::SocketAddr::new(ip, actual.port()),
            config.mcp.path
        )
    });
    let managed_runtime = state.managed_session_runtime(endpoint.as_deref())?;
    let router = create_router_with_frontend(state, &config, frontend_mode);
    if let Some((runtime, lease)) = managed_runtime {
        tokio::spawn(async move {
            if runtime.run(lease).await.is_err() {
                tracing::error!("Managed session runtime stopped");
            }
        });
    }
    tracing::info!("listening on {}", addr);
    if let Some(mcp_url) = config.mcp_endpoint_url() {
        tracing::info!("mcp enabled at {}", mcp_url);
    }

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;
    Ok(())
}
