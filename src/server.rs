//! Process bootstrap shared by the CLI binary and the desktop app.
use crate::{
    config::AppConfig,
    repositories::database::DatabaseRepository,
    routes::{create_router_with_frontend, shutdown::end_event_streams_on_shutdown},
    services::frontend::FrontendMode,
    state::AppState,
};
use anyhow::Result;
use axum::Router;
use std::{future::Future, net::SocketAddr};
use tokio::{net::TcpListener, sync::watch};

pub struct PreparedServer {
    listener: TcpListener,
    router: Router,
    addr: SocketAddr,
}

/// Opens persistence, seeds, and wires runtimes. `config.port` must match the listener.
pub async fn prepare(
    config: AppConfig,
    frontend_mode: FrontendMode,
    listener: TcpListener,
) -> Result<PreparedServer> {
    let database =
        DatabaseRepository::connect(config.database_driver, &config.database_url).await?;
    let transfer_config = crate::services::data_transfer::config::TransferConfig::from_env()?;
    let transfer = if transfer_config.enabled {
        Some(
            crate::services::data_transfer::service::TransferService::new(
                database.transfers(),
                transfer_config,
            )?,
        )
    } else {
        None
    };
    let mut state = AppState::new(database);
    let mut recovery_pending = false;
    if let Some(transfer) = transfer {
        if transfer.recover().await.is_err() {
            recovery_pending = true;
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
    // Never write over a restore whose outcome is still unknown; the next start seeds.
    if recovery_pending {
        tracing::warn!("Bee Team HQ onboarding seed skipped until transfer recovery completes");
    } else {
        state.backend().ensure_onboarding().await.map_err(|e| {
            anyhow::anyhow!(
                "Bee Team HQ onboarding seed failed ({}): {}",
                e.code,
                e.error
            )
        })?;
    }

    let addr = config.listen_addr()?;
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
    // Configure once before cloning into HTTP and Conversation dispatch.
    let mut runtime_config = config.clone();
    runtime_config.host = ip;
    runtime_config.port = actual.port();
    if config.host.is_loopback() {
        state = state.with_leader_chat_runtime(&runtime_config);
    }
    let managed_runtime = state.managed_session_runtime(endpoint.as_deref())?;
    state.managed_agents().start().await?;
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
    Ok(PreparedServer {
        listener,
        router,
        addr: actual,
    })
}

impl PreparedServer {
    pub fn local_addr(&self) -> SocketAddr {
        self.addr
    }

    pub async fn serve<F>(self, shutdown: F) -> Result<()>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let (stop, stopping) = watch::channel(false);
        axum::serve(
            self.listener,
            self.router
                .layer(axum::middleware::from_fn(move |request, next| {
                    end_event_streams_on_shutdown(stopping.clone(), request, next)
                }))
                .into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move {
            shutdown.await;
            let _ = stop.send(true);
        })
        .await?;
        Ok(())
    }
}
