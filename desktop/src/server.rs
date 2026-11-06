use reqwest::blocking::Client;
use serde_json::Value;
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub struct Connection {
    pub url: String,
    pub child: Option<Child>,
}

fn compatible(info: &Value) -> bool {
    let contains = |field: &str, value: &str| {
        info[field]
            .as_array()
            .is_some_and(|entries| entries.iter().any(|entry| entry == value))
    };
    info["apiVersion"] == env!("CARGO_PKG_VERSION")
        && contains("supportedContractVersions", "v2")
        && contains("capabilities", "teams.role-icons")
        && contains("capabilities", "mcp")
}

fn ready(client: &Client, base: &str) -> Result<(), String> {
    let info = client
        .get(format!("{base}/api/v1/info"))
        .send()
        .and_then(|response| response.error_for_status())
        .and_then(|response| response.json())
        .map_err(|_| "The configured port does not serve Bee Team discovery.")?;
    if !compatible(&info) {
        return Err("This server requires a matching Bee Team release with MCP enabled.".into());
    }
    let panel = client
        .get(format!("{base}/app/"))
        .send()
        .map_err(|e| e.to_string())?;
    if !panel.status().is_success()
        || !panel
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.starts_with("text/html"))
    {
        return Err("The running server needs its embedded panel enabled.".into());
    }
    Ok(())
}

pub fn connect() -> Result<Connection, String> {
    let port = std::env::var("APP_PORT")
        .unwrap_or_else(|_| "59865".into())
        .parse::<u16>()
        .map_err(|_| "Invalid APP_PORT.")?;
    if port == 0 {
        return Err("APP_PORT must be greater than zero.".into());
    }
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    let base = format!("http://{addr}");
    let url = format!("{base}/app/");
    let client = Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;
    // Windows may time out when connecting to an unused loopback port. A
    // successful bind proves availability; the server repeats the bind before
    // opening storage, so a competing launch still fails safely.
    if TcpListener::bind(addr).is_err() {
        ready(&client, &base)?;
        return Ok(Connection { url, child: None });
    }
    let executable = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .with_file_name(format!("beeteam-server{}", std::env::consts::EXE_SUFFIX));
    let mut command = Command::new(executable);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .arg("--desktop-parent-pipe")
        .env("APP_HOST", "127.0.0.1")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start the bundled Bee Team server: {e}"))?;
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return Err(format!(
                "Bundled server exited ({status}). Check the port and database configuration."
            ));
        }
        if ready(&client, &base).is_ok() {
            return Ok(Connection {
                url,
                child: Some(child),
            });
        }
        if Instant::now() >= deadline {
            drop(child.stdin.take());
            return Err("The bundled server did not become ready in time.".into());
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn requires_matching_release_contract_and_mcp() {
        let mut info = serde_json::json!({"apiVersion":env!("CARGO_PKG_VERSION"),"supportedContractVersions":["v2"],"capabilities":["teams.role-icons","mcp"]});
        assert!(compatible(&info));
        info["capabilities"] = serde_json::json!([]);
        assert!(!compatible(&info));
        assert!(!compatible(&Value::Null));
    }
}
