//! Acceptance-only passthrough. Inject a wrong MCP into the official Codex
//! process without editing any user's global configuration. Not a runtime SDK.
fn main() -> anyhow::Result<()> {
    let native = std::env::var("BEE_PROOF_CODEX_NATIVE")?;
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().is_some_and(|arg| arg == "app-server") {
        let url = std::env::var("BEE_PROOF_MCP_CANARY")?;
        let url = url::Url::parse(&url)?;
        anyhow::ensure!(
            url.host_str() == Some("127.0.0.1"),
            "Canary must be owned loopback HTTP"
        );
        args.extend([
            "-c".into(),
            format!(
                "mcp_servers.beeteam_wrong.url={}",
                serde_json::to_string(url.as_str())?
            ),
        ]);
    }
    let mut command = std::process::Command::new(native);
    command.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let status = command.status()?;
    std::process::exit(status.code().unwrap_or(1));
}
