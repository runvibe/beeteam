use super::*;
use std::{path::PathBuf, process::Stdio};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout},
};
pub(super) struct Wire {
    child: Child,
    input: ChildStdin,
    output: Lines<BufReader<ChildStdout>>,
    pub thread: String,
    next: u64,
    pending: VecDeque<Value>,
}
impl Wire {
    pub async fn start(sdp: String, instructions: String) -> Result<(Self, String)> {
        let executable = std::env::var_os("BEE_CODEX_EXECUTABLE")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute() && p.is_file())
            .ok_or_else(|| {
                Failure::new(
                    "voice_not_configured",
                    "Configure the installed Codex executable to enable voice",
                )
            })?;
        let root = std::env::temp_dir().join("beeteam-voice");
        std::fs::create_dir_all(&root).map_err(|_| unavailable())?;
        let mut command = tokio::process::Command::new(executable);
        command
            .args([
                "-c",
                "notify=[]",
                "-c",
                "features.hooks=false",
                "-c",
                "features.plugins=false",
                "app-server",
                "--listen",
                "stdio://",
            ])
            .current_dir(&root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.as_std_mut().creation_flags(0x08000000);
        }
        let mut child = command.spawn().map_err(|_| unavailable())?;
        let input = child.stdin.take().ok_or_else(unavailable)?;
        let output = BufReader::new(child.stdout.take().ok_or_else(unavailable)?).lines();
        let mut wire = Self {
            child,
            input,
            output,
            thread: String::new(),
            next: 0,
            pending: VecDeque::new(),
        };
        wire.request("initialize",json!({"clientInfo":{"name":"beeteam-voice","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":true}})).await?;
        wire.write(json!({"method":"initialized"})).await?;
        let account = wire
            .request("account/read", json!({"refreshToken":false}))
            .await?;
        if account["account"].is_null() {
            return Err(Failure::new(
                "needs_auth",
                "Sign in to the installed Codex before starting voice",
            ));
        }
        let config = wire
            .request("config/read", json!({"cwd":root,"includeLayers":false}))
            .await?;
        let overrides = coordinator_config(&config["config"])?;
        let thread=wire.request("thread/start",json!({"cwd":root,"ephemeral":true,"approvalPolicy":"never","sandbox":"read-only","config":overrides,"developerInstructions":instructions,"dynamicTools":[{"type":"function","name":"execute_codex","description":"Send a clear user execution request to the selected Bee Team Codex agent. Ask the user for clarification when intent is ambiguous.","inputSchema":{"type":"object","properties":{"content":{"type":"string"}},"required":["content"],"additionalProperties":false}}]})).await?;
        wire.thread = thread["thread"]["id"]
            .as_str()
            .ok_or_else(unavailable)?
            .to_owned();
        wire.request("thread/realtime/start",json!({"threadId":wire.thread,"version":"v3","outputModality":"audio","transport":{"type":"webrtc","sdp":sdp},"includeStartupContext":false,"clientManagedHandoffs":false,"flushTranscriptTailOnSessionEnd":false,"prompt":instructions,"realtimeStartInstructions":instructions})).await?;
        loop {
            let message = wire.line().await?;
            match message["method"].as_str() {
                Some("thread/realtime/sdp") => {
                    let answer = message["params"]["sdp"]
                        .as_str()
                        .ok_or_else(unavailable)?
                        .to_owned();
                    return Ok((wire, answer));
                }
                Some("thread/realtime/error" | "thread/realtime/closed") => {
                    return Err(Failure::new(
                        "voice_unavailable",
                        "Installed Codex could not start realtime voice; check account access and CLI version",
                    ));
                }
                _ => {}
            }
        }
    }
    pub async fn line(&mut self) -> Result<Value> {
        if let Some(value) = self.pending.pop_front() {
            return Ok(value);
        }
        self.raw_line().await
    }
    async fn raw_line(&mut self) -> Result<Value> {
        let line = self
            .output
            .next_line()
            .await
            .map_err(|_| unavailable())?
            .ok_or_else(unavailable)?;
        if line.len() > 1024 * 1024 {
            return Err(unavailable());
        }
        serde_json::from_str(&line).map_err(|_| unavailable())
    }
    async fn write(&mut self, value: Value) -> Result<()> {
        let mut bytes = serde_json::to_vec(&value).map_err(|_| unavailable())?;
        bytes.push(b'\n');
        tokio::time::timeout(Duration::from_secs(5), async {
            self.input
                .write_all(&bytes)
                .await
                .map_err(|_| unavailable())?;
            self.input.flush().await.map_err(|_| unavailable())
        })
        .await
        .map_err(|_| unavailable())?
    }

    pub(super) async fn request(&mut self, method: &str, params: Value) -> Result<Value> {
        self.next += 1;
        let id = self.next;
        self.write(json!({"id":id,"method":method,"params":params}))
            .await?;
        loop {
            let response = self.raw_line().await?;
            if response["id"] == id && response.get("method").is_none() {
                if !response["error"].is_null() {
                    return Err(Failure::new(
                        "voice_unavailable",
                        "Installed Codex rejected voice setup; update Codex and check account access",
                    ));
                }
                return Ok(response["result"].clone());
            }
            if response.get("method").is_some() && response.get("id").is_some() {
                self.reject(response["id"].clone()).await?;
                continue;
            }
            if self.pending.len() >= 256 {
                return Err(unavailable());
            }
            self.pending.push_back(response);
        }
    }
    pub async fn reply(&mut self, id: Value, result: Value) -> Result<()> {
        self.write(json!({"id":id,"result":result})).await
    }
    pub async fn reject(&mut self, id: Value) -> Result<()> {
        self.write(json!({"id":id,"error":{"code":-32601,"message":"Voice coordinator only supports execute_codex"}})).await
    }
    pub async fn append(&mut self, text: String) -> Result<u64> {
        self.next += 1;
        self.write(json!({
            "id": self.next,
            "method": "thread/realtime/appendText",
            "params": {"threadId": self.thread, "text": text, "role": "developer"}
        }))
        .await?;
        Ok(self.next)
    }
    pub async fn stop(&mut self) -> Result<Vec<Value>> {
        self.next += 1;
        let _ = self.write(json!({"id":self.next,"method":"thread/realtime/stop","params":{"threadId":self.thread}})).await;
        let mut final_messages = Vec::new();
        let _ = tokio::time::timeout(Duration::from_secs(2), async {
            while let Ok(message) = self.line().await {
                if message.get("method").is_some() && message.get("id").is_some() {
                    self.reject(message["id"].clone()).await?;
                } else if message["method"] == "thread/realtime/closed" {
                    break;
                } else if message["method"] == "thread/realtime/transcript/done" {
                    final_messages.push(message);
                    if final_messages.len() >= MAX_EVENTS {
                        break;
                    }
                }
            }
            Ok::<(), Failure>(())
        })
        .await;
        let _ = tokio::time::timeout(Duration::from_secs(5), self.child.kill()).await;
        Ok(final_messages)
    }
}

fn coordinator_config(config: &Value) -> Result<Value> {
    if !config.is_object() {
        return Err(unavailable());
    }
    let mut overrides = json!({"web_search":"disabled","features.shell_tool":false,"features.unified_exec":false,"features.apps":false,"features.multi_agent":false,"features.js_repl":false,"features.view_image":false,"features.multi_agent_v2":false,"features.plugins":false,"features.tool_suggest":false,"features.recommended_plugins":false,"features.request_permissions_tool":false,"features.code_mode":false,"features.code_mode_host":false,"features.hooks":false,"notify":[]});
    if let Some(servers) = config["mcp_servers"].as_object() {
        for name in servers.keys() {
            overrides[format!("mcp_servers.{name}.enabled")] = json!(false);
        }
    }
    Ok(overrides)
}

#[cfg(test)]
pub(super) fn fixture() -> Wire {
    let python = if cfg!(windows) { "python" } else { "python3" };
    let mut child = tokio::process::Command::new(python)
        .arg("-u")
        .arg(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/fake_codex_voice.py"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .expect("Python voice protocol fixture");
    Wire {
        input: child.stdin.take().unwrap(),
        output: BufReader::new(child.stdout.take().unwrap()).lines(),
        child,
        thread: "owned-voice-thread".into(),
        next: 0,
        pending: VecDeque::new(),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn preserves_sdp_notification_before_rpc_response() {
        let mut wire = fixture();
        wire.request("test/interleaved", json!({})).await.unwrap();
        assert_eq!(wire.line().await.unwrap()["params"]["sdp"], "answer");
        wire.stop().await.unwrap();
    }
    #[tokio::test]
    async fn provider_rejection_does_not_leak_raw_details() {
        let mut wire = fixture();
        let error = wire.request("test/reject", json!({})).await.unwrap_err();
        assert_eq!(error.code, "voice_unavailable");
        assert!(!error.error.contains("private provider detail"));
        wire.stop().await.unwrap();
    }
    #[test]
    fn coordinator_disables_inherited_tools_hooks_and_notifications() {
        let config =
            coordinator_config(&json!({"mcp_servers":{"personal":{"enabled":true}}})).unwrap();
        for feature in [
            "shell_tool",
            "view_image",
            "multi_agent",
            "multi_agent_v2",
            "apps",
            "plugins",
            "code_mode",
            "code_mode_host",
        ] {
            assert_eq!(config[format!("features.{feature}")], false);
        }
        assert_eq!(config["mcp_servers.personal.enabled"], false);
        assert_eq!(config["web_search"], "disabled");
        assert_eq!(
            coordinator_config(&json!({"notify":["command"]})).unwrap()["notify"],
            json!([])
        );
        assert_eq!(
            coordinator_config(&json!({"hooks":{"start":"command"}})).unwrap()["features.hooks"],
            false
        );
    }
}
