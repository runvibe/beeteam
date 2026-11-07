//! Official Codex App Server JSONL adapter. No community SDK and no shell command construction.
use crate::{dto::session_delivery::*, repositories::contracts::SessionProvider};
use serde_json::{json, Value};
use std::{future::Future, path::PathBuf, pin::Pin, process::Stdio, time::Duration};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    sync::mpsc,
};

pub struct CodexSessionProvider {
    pub executable: PathBuf,
    pub timeout: Duration,
    pub mcp_endpoint: String,
}

/// Deterministic protocol projection, independently tested without inference.
pub struct Protocol {
    thread_id: String,
    turn_id: Option<String>,
    text: Vec<String>,
}
impl Protocol {
    pub fn new(thread_id: &str) -> Self {
        Self {
            thread_id: thread_id.into(),
            turn_id: None,
            text: vec![],
        }
    }
    pub fn accept(&mut self, message: &Value) -> Result<Option<SessionEvent>, SessionFailure> {
        if message["id"] == 3 {
            if !message["error"].is_null() {
                return Err(SessionFailure::new(
                    "provider_rejected",
                    "Codex rejected the turn",
                    false,
                ));
            }
            let id = message
                .pointer("/result/turn/id")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    SessionFailure::new("invalid_protocol", "Missing turn acknowledgement", true)
                })?;
            self.turn_id = Some(id.into());
            return Ok(Some(SessionEvent::Accepted { turn_id: id.into() }));
        }
        let params = &message["params"];
        if params["threadId"] != self.thread_id {
            return Ok(None);
        }
        match message["method"].as_str() {
            Some("item/completed")
                if params["item"]["type"] == "agentMessage"
                    && params["item"]["phase"] != "commentary" =>
            {
                if let Some(text) = params["item"]["text"].as_str() {
                    self.text.push(text.into());
                }
            }
            Some("turn/completed") => {
                let turn = &params["turn"];
                if self.turn_id.as_deref() != turn["id"].as_str() {
                    return Err(SessionFailure::new(
                        "invalid_protocol",
                        "Mismatched completed turn",
                        true,
                    ));
                }
                if turn["status"] != "completed" {
                    return Err(SessionFailure::new(
                        "turn_failed",
                        "Codex turn failed or was interrupted",
                        true,
                    ));
                }
                let text = self.text.join("\n\n");
                if text.len() > 16384 {
                    return Err(SessionFailure::new(
                        "reply_too_large",
                        "Reply exceeds Conversation limit",
                        true,
                    ));
                }
                return Ok(Some(SessionEvent::Completed {
                    turn_id: self.turn_id.clone().unwrap(),
                    text,
                }));
            }
            _ => {}
        }
        Ok(None)
    }
}

impl CodexSessionProvider {
    async fn run(
        &self,
        target: &SessionDestination,
        text: &str,
        events: mpsc::Sender<SessionEvent>,
    ) -> Result<(), SessionFailure> {
        if target.harness != "codex" {
            return Err(SessionFailure::new(
                "unsupported_provider",
                "Provider adapter is not implemented",
                false,
            ));
        }
        let mut command = tokio::process::Command::new(&self.executable);
        command
            .args([
                "app-server",
                "--listen",
                "stdio://",
                "-c",
                "features.apps=false",
            ])
            .current_dir(&target.project_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.as_std_mut().creation_flags(0x08000000);
        }
        let mut child = command.spawn().map_err(|_| {
            SessionFailure::new(
                "provider_unavailable",
                "Cannot start configured Codex executable",
                false,
            )
        })?;
        let mut input = child.stdin.take().unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap()).lines();
        let mut sent = false;
        let namespace = format!(
            "beeteam_{}",
            &uuid::Uuid::new_v4().simple().to_string()[..12]
        );
        let mut scope = super::codex_mcp_scope::McpScope::new(&self.mcp_endpoint, &namespace)?;
        let run = async {
            write(&mut input, json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"beeteam","title":"Bee Team","version":env!("CARGO_PKG_VERSION")}}})).await?;
            let mut protocol = Protocol::new(&target.external_id);
            let mut inventory = Vec::new();
            let mut current_inventory = Vec::new();
            loop {
                let line = output
                    .next_line()
                    .await
                    .map_err(|_| {
                        SessionFailure::new("provider_io", "Cannot read Codex protocol", sent)
                    })?
                    .ok_or_else(|| {
                        SessionFailure::new(
                            "provider_exited",
                            "Codex exited before completion",
                            sent,
                        )
                    })?;
                if line.len() > 8 * 1024 * 1024 {
                    return Err(SessionFailure::new(
                        "invalid_protocol",
                        "Provider frame exceeds limit",
                        sent,
                    ));
                }
                let message: Value = serde_json::from_str(&line).map_err(|_| {
                    SessionFailure::new("invalid_protocol", "Invalid provider JSON", sent)
                })?;
                match message["id"].as_i64() {
                    Some(1) if message.get("method").is_none() => {
                        if !message["error"].is_null() {
                            return Err(SessionFailure::new(
                                "handshake_failed",
                                "Codex initialization rejected",
                                false,
                            ));
                        }
                        write(&mut input, json!({"method":"initialized","params":{}})).await?;
                        write(&mut input,json!({"id":4,"method":"mcpServerStatus/list","params":{"limit":100,"detail":"toolsAndAuthOnly"}})).await?;
                    }
                    Some(4) if message.get("method").is_none() => {
                        if !message["error"].is_null() {
                            return Err(SessionFailure::new(
                                "mcp_scope_unverified",
                                "Codex cannot inventory managed MCP connections",
                                false,
                            ));
                        }
                        let data = message["result"]["data"].as_array().ok_or_else(|| {
                            SessionFailure::new("invalid_protocol", "Missing MCP inventory", false)
                        })?;
                        inventory.extend(data.iter().cloned());
                        if inventory.len() > 512 {
                            return Err(SessionFailure::new(
                                "mcp_scope_unverified",
                                "MCP inventory exceeds supported limit",
                                false,
                            ));
                        }
                        if let Some(cursor) = super::codex_mcp_scope::inventory_cursor(&message["result"])? {
                            write(&mut input,json!({"id":4,"method":"mcpServerStatus/list","params":{"limit":100,"detail":"toolsAndAuthOnly","cursor":cursor}})).await?;
                        } else {
                            scope.observe(&inventory)?;
                            write(&mut input, json!({"id":2,"method":"thread/resume","params":{"threadId":target.external_id,"config":scope.configuration()}})).await?;
                        }
                    }
                    Some(2) if message.get("method").is_none() => {
                        if !message["error"].is_null() {
                            return Err(SessionFailure::new(
                                "session_unavailable",
                                "Cannot resume the bound Codex thread",
                                false,
                            ));
                        }
                        let result = &message["result"];
                        if result["thread"]["id"] != target.external_id {
                            return Err(SessionFailure::new(
                                "destination_mismatch",
                                "Resumed another thread",
                                false,
                            ));
                        }
                        let actual = result["cwd"]
                            .as_str()
                            .or_else(|| result["thread"]["cwd"].as_str());
                        if !same_root(actual, &target.project_root) {
                            return Err(SessionFailure::new(
                                "project_mismatch",
                                "Provider working directory differs from binding",
                                false,
                            ));
                        }
                        if result["thread"]["status"]["type"] == "active" {
                            return Err(SessionFailure::new(
                                "session_busy",
                                "Bound Codex session is busy",
                                false,
                            ));
                        }
                        write(&mut input,json!({"id":5,"method":"mcpServerStatus/list","params":{"threadId":target.external_id,"limit":100,"detail":"toolsAndAuthOnly"}})).await?;
                    }
                    Some(5) if message.get("method").is_none() => {
                        if !message["error"].is_null() {
                            return Err(SessionFailure::new(
                                "mcp_scope_unverified",
                                "Codex cannot verify the thread's MCP origin",
                                false,
                            ));
                        }
                        let data = message["result"]["data"].as_array().ok_or_else(|| {
                            SessionFailure::new(
                                "invalid_protocol",
                                "Missing thread MCP inventory",
                                false,
                            )
                        })?;
                        current_inventory.extend(data.iter().cloned());
                        if current_inventory.len() > 512 {
                            return Err(SessionFailure::new(
                                "mcp_scope_unverified",
                                "MCP inventory exceeds supported limit",
                                false,
                            ));
                        }
                        if let Some(cursor) = super::codex_mcp_scope::inventory_cursor(&message["result"])? {
                            write(&mut input,json!({"id":5,"method":"mcpServerStatus/list","params":{"threadId":target.external_id,"limit":100,"detail":"toolsAndAuthOnly","cursor":cursor}})).await?;
                            continue;
                        }
                        scope.verify(&current_inventory)?;
                        events
                            .send(SessionEvent::Ready {
                                backend_origin: scope.origin().into(),
                            })
                            .await
                            .map_err(|_| {
                                SessionFailure::new(
                                    "consumer_closed",
                                    "Delivery consumer closed",
                                    false,
                                )
                            })?;
                        // Set before write: a partial write is already an uncertain outcome.
                        sent = true;
                        write(&mut input, json!({"id":3,"method":"turn/start","params":{"threadId":target.external_id,"disabledPluginIds":scope.disabled_plugins(&current_inventory),"input":[{"type":"text","text":format!("{}{text}",scope.context())}]}})).await?;
                    }
                    _ => {}
                }
                if message.get("method").is_some() && message.get("id").is_some() {
                    // Never weaken or auto-approve the user's saved permission policy.
                    write(&mut input, json!({"id":message["id"],"error":{"code":-32601,"message":"Approval requires the owning harness"}})).await?;
                    return Err(SessionFailure::new("approval_required", "Continue approval in the owning Codex interface; delivery will not be retried", sent));
                }
                if let Some(event) = protocol.accept(&message)? {
                    let done = matches!(event, SessionEvent::Completed { .. });
                    events.send(event).await.map_err(|_| {
                        SessionFailure::new("consumer_closed", "Delivery consumer closed", sent)
                    })?;
                    if done {
                        return Ok(());
                    }
                }
            }
        };
        let result = tokio::time::timeout(self.timeout, run).await;
        let failure = result.unwrap_or_else(|_| {
            Err(SessionFailure::new(
                "provider_timeout",
                "Codex response timed out",
                sent,
            ))
        });
        let _ = child.kill().await;
        failure.map_err(|mut error| {
            if !sent {
                error.uncertain = false;
            }
            error
        })
    }
}
fn same_root(actual: Option<&str>, expected: &str) -> bool {
    actual
        .and_then(|root| std::fs::canonicalize(root).ok())
        .zip(std::fs::canonicalize(expected).ok())
        .is_some_and(|(a, b)| a == b)
}
async fn write(
    input: &mut tokio::process::ChildStdin,
    message: Value,
) -> Result<(), SessionFailure> {
    let mut bytes = serde_json::to_vec(&message).unwrap();
    bytes.push(b'\n');
    input
        .write_all(&bytes)
        .await
        .map_err(|_| SessionFailure::new("provider_io", "Cannot write Codex protocol", true))?;
    input
        .flush()
        .await
        .map_err(|_| SessionFailure::new("provider_io", "Cannot flush Codex protocol", true))
}
impl SessionProvider for CodexSessionProvider {
    fn deliver<'a>(
        &'a self,
        destination: &'a SessionDestination,
        text: &'a str,
        events: mpsc::Sender<SessionEvent>,
    ) -> Pin<Box<dyn Future<Output = Result<(), SessionFailure>> + Send + 'a>> {
        Box::pin(self.run(destination, text, events))
    }
}
