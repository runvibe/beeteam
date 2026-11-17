//! Explicit opt-in acceptance probe. Supply only a test thread owned by the caller.
use beeteam::{
    dto::session_delivery::SessionDestination,
    repositories::{codex_session::CodexSessionProvider, contracts::SessionProvider},
};
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let provider = CodexSessionProvider {
        executable: std::env::var("BEE_CODEX_EXECUTABLE")?.into(),
        timeout: std::time::Duration::from_secs(90),
        mcp_endpoint: std::env::var("BEE_PROOF_MCP_URL")?,
    };
    let destination = SessionDestination {
        harness: "codex".into(),
        installation_id: "isolated-proof".into(),
        external_id: std::env::var("BEE_PROOF_THREAD")?,
        project_root: std::env::var("BEE_PROOF_ROOT")?,
    };
    let (tx, mut rx) = tokio::sync::mpsc::channel(8);
    provider
        .deliver(
            &destination,
            "What exact marker did I ask you to remember? Reply only with it. Do not use tools.",
            tx,
        )
        .await?;
    while let Some(event) = rx.recv().await {
        println!("{event:?}");
    }
    Ok(())
}
