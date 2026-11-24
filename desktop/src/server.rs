use beeteam::{config::AppConfig, server, services::frontend::FrontendMode};
use std::net::{IpAddr, Ipv4Addr};
use tokio::{sync::oneshot, task::JoinHandle};

pub struct RunningServer {
    pub url: String,
    pub shutdown: oneshot::Sender<()>,
    pub task: JoinHandle<anyhow::Result<()>>,
}

/// Starts the Bee Team server in this process on a loopback ephemeral port.
pub async fn start() -> anyhow::Result<RunningServer> {
    let mut config = AppConfig::from_env()?;
    config.host = IpAddr::V4(Ipv4Addr::LOCALHOST);
    let listener = tokio::net::TcpListener::bind((config.host, 0)).await?;
    config.port = listener.local_addr()?.port();
    let prepared = server::prepare(config, FrontendMode::Embedded, listener).await?;
    let url = format!("http://{}/app/", prepared.local_addr());
    let (shutdown, rx) = oneshot::channel::<()>();
    let task = tokio::spawn(prepared.serve(async {
        let _ = rx.await;
    }));
    Ok(RunningServer {
        url,
        shutdown,
        task,
    })
}
