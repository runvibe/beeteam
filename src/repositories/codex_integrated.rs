//! Official local Codex process adapter for Bee Team-owned chats.
mod recovery;
use super::{
    codex_mcp_scope::{CodexToolProfile, McpScope},
    integrated_provider::*,
};
use crate::dto::session_delivery::{SessionDestination, SessionFailure};
use serde_json::{json, Value};
use std::{collections::HashMap, path::PathBuf, process::Stdio, time::Duration};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout},
    sync::mpsc,
};
use uuid::Uuid;
pub struct CodexIntegratedProvider {
    pub executable: PathBuf,
    pub mcp_endpoint: String,
    pub profile: CodexToolProfile,
}
struct Wire {
    _child: Child,
    input: ChildStdin,
    output: Lines<BufReader<ChildStdout>>,
    next: u64,
    pending: std::collections::VecDeque<Value>,
}
fn fail(code: &'static str, text: &str, uncertain: bool) -> SessionFailure {
    SessionFailure::new(code, text, uncertain)
}
impl Wire {
    async fn open(executable: &PathBuf, root: &str) -> Result<Self, SessionFailure> {
        if !std::path::Path::new(root).is_absolute() || !std::path::Path::new(root).is_dir() {
            return Err(fail(
                "invalid_request",
                "Project folder must exist and be absolute",
                false,
            ));
        }
        let mut cmd = tokio::process::Command::new(executable);
        cmd.args(["app-server", "--listen", "stdio://"])
            .current_dir(root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.as_std_mut().creation_flags(0x08000000);
        }
        let mut child = cmd.spawn().map_err(|_| {
            fail(
                "provider_unavailable",
                "Cannot start configured Codex executable",
                false,
            )
        })?;
        let input = child.stdin.take().unwrap();
        let output = BufReader::new(child.stdout.take().unwrap()).lines();
        let mut w = Self {
            _child: child,
            input,
            output,
            next: 10,
            pending: Default::default(),
        };
        w.request("initialize",json!({"clientInfo":{"name":"beeteam","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":true}})).await?;
        w.write(json!({"method":"initialized","params":{}})).await?;
        Ok(w)
    }
    async fn write(&mut self, v: Value) -> Result<(), SessionFailure> {
        let mut bytes = serde_json::to_vec(&v).unwrap();
        bytes.push(b'\n');
        self.input
            .write_all(&bytes)
            .await
            .map_err(|_| fail("provider_io", "Cannot write Codex protocol", true))?;
        self.input
            .flush()
            .await
            .map_err(|_| fail("provider_io", "Cannot flush Codex protocol", true))
    }
    async fn line(&mut self) -> Result<Value, SessionFailure> {
        let line = self
            .output
            .next_line()
            .await
            .map_err(|_| fail("provider_io", "Cannot read Codex protocol", true))?
            .ok_or_else(|| fail("provider_exited", "Codex exited", true))?;
        if line.len() > 8 * 1024 * 1024 {
            return Err(fail(
                "invalid_protocol",
                "Provider frame exceeds limit",
                true,
            ));
        }
        serde_json::from_str(&line)
            .map_err(|_| fail("invalid_protocol", "Provider JSON invalid", true))
    }
    async fn request(&mut self, method: &str, params: Value) -> Result<Value, SessionFailure> {
        self.next += 1;
        let id = self.next;
        self.write(json!({"id":id,"method":method,"params":params}))
            .await?;
        tokio::time::timeout(Duration::from_secs(45), async {
            loop {
                let v = self.line().await?;
                if v["id"] == id && v.get("method").is_none() {
                    if !v["error"].is_null() {
                        return Err(fail(
                            "provider_rejected",
                            "Codex rejected protocol request",
                            false,
                        ));
                    }
                    return Ok(v["result"].clone());
                }
                if v.get("method").is_some() && v.get("id").is_some() {
                    return Err(fail(
                        "unsupported_capability",
                        "Provider requested interaction during initialization",
                        false,
                    ));
                }
                if self.pending.len() >= 1024 {
                    return Err(fail(
                        "invalid_protocol",
                        "Too many initialization notifications",
                        false,
                    ));
                }
                self.pending.push_back(v);
            }
        })
        .await
        .map_err(|_| fail("provider_timeout", "Codex initialization timed out", false))?
    }
    async fn inventory(&mut self, thread: Option<&str>) -> Result<Vec<Value>, SessionFailure> {
        let mut all = vec![];
        let mut cursor = Value::Null;
        loop {
            let mut p = json!({"limit":100,"detail":"toolsAndAuthOnly"});
            if let Some(t) = thread {
                p["threadId"] = json!(t)
            }
            if !cursor.is_null() {
                p["cursor"] = cursor.clone()
            }
            let r = self.request("mcpServerStatus/list", p).await?;
            all.extend(
                r["data"]
                    .as_array()
                    .ok_or_else(|| fail("invalid_protocol", "MCP inventory unavailable", false))?
                    .iter()
                    .cloned(),
            );
            if all.len() > 512 {
                return Err(fail("invalid_protocol", "MCP inventory too large", false));
            }
            match super::codex_mcp_scope::inventory_cursor(&r)? {
                Some(c) => cursor = json!(c),
                None => return Ok(all),
            }
        }
    }
}
impl CodexIntegratedProvider {
    fn selected_profile(&self, profile: &Value) -> Result<CodexToolProfile, SessionFailure> {
        if profile.is_null() {
            Ok(self.profile.clone())
        } else {
            serde_json::from_value(profile.clone())
                .map_err(|_| fail("invalid_request", "Invalid tool profile", false))
        }
    }

    async fn session(
        &self,
        root: &str,
        thread: Option<&str>,
        profile: &Value,
    ) -> Result<(Wire, String, McpScope, Vec<String>), SessionFailure> {
        let mut w = Wire::open(&self.executable, root).await?;
        let account = w
            .request("account/read", json!({"refreshToken":false}))
            .await?;
        if account["account"].is_null() && account["requiresOpenaiAuth"] != false {
            return Err(fail(
                "needs_auth",
                "Sign into Codex locally before using integrated chat",
                false,
            ));
        }
        let ns = format!("beeteam_{}", &Uuid::new_v4().simple().to_string()[..12]);
        let mut scope =
            McpScope::with_tools(&self.mcp_endpoint, &ns, self.selected_profile(profile)?)?;
        scope.observe(&w.inventory(None).await?)?;
        if !scope.skill_roots().is_empty() {
            w.request(
                "skills/extraRoots/set",
                json!({"extraRoots":scope.skill_roots()}),
            )
            .await?;
        }
        let mut params = json!({"config":scope.configuration(),"cwd":root});
        let method = if let Some(t) = thread {
            params["threadId"] = json!(t);
            "thread/resume"
        } else {
            params["ephemeral"] = json!(false);
            params["approvalPolicy"] = json!("on-request");
            params["sandbox"] = json!("workspace-write");
            "thread/start"
        };
        let result = w.request(method, params).await?;
        let id = result["thread"]["id"]
            .as_str()
            .ok_or_else(|| fail("invalid_protocol", "Missing thread ID", false))?
            .to_owned();
        if thread.is_some_and(|t| t != id) {
            return Err(fail(
                "destination_mismatch",
                "Provider resumed another thread",
                false,
            ));
        }
        let cwd = result["cwd"]
            .as_str()
            .or_else(|| result["thread"]["cwd"].as_str())
            .unwrap_or("");
        if std::fs::canonicalize(cwd).ok() != std::fs::canonicalize(root).ok() {
            return Err(fail(
                "project_mismatch",
                "Provider project differs from binding",
                false,
            ));
        }
        if result["thread"]["status"]["type"] == "active" {
            return Err(fail(
                "session_busy",
                "Provider thread already active",
                false,
            ));
        }
        let inventory = w.inventory(Some(&id)).await?;
        if let Err(error) = scope.verify(&inventory) {
            let safe:Vec<_>=inventory.iter().map(|s|json!({"name":s["name"],"status":s["runtimeStatus"],"origin":s["httpOrigin"],"pluginId":s["pluginId"],"tools":s["tools"].as_object().map(|t|t.keys().collect::<Vec<_>>())})).collect();
            tracing::warn!(inventory=%json!(safe),"Integrated MCP verification failed");
            return Err(error);
        }
        let disabled_plugins = scope.disabled_plugins(&inventory);
        Ok((w, id, scope, disabled_plugins))
    }
    async fn execute(
        &self,
        target: &SessionDestination,
        text: &str,
        profile: &Value,
        events: mpsc::Sender<IntegratedEvent>,
        mut controls: mpsc::Receiver<Control>,
    ) -> Result<(), SessionFailure> {
        if target.harness != "codex" {
            return Err(fail(
                "unsupported_provider",
                "Only Codex is supported",
                false,
            ));
        }
        let (mut w, thread, scope, disabled_plugins) = self
            .session(&target.project_root, Some(&target.external_id), profile)
            .await?;
        let result=w.request("turn/start",json!({"threadId":thread,"disabledPluginIds":disabled_plugins,"input":[{"type":"text","text":format!("{}{}",scope.context(),text)}]})).await.map_err(|mut e|{e.uncertain=true;e})?;
        let turn = result["turn"]["id"]
            .as_str()
            .ok_or_else(|| fail("invalid_protocol", "Turn ID unavailable", true))?
            .to_owned();
        emit(&events, IntegratedEvent::Accepted(turn.clone())).await?;
        let mut last_emit = std::time::Instant::now() - Duration::from_secs(1);
        let mut texts: Vec<(String, String)> = Vec::new();
        let mut changed_files: HashMap<String, Vec<String>> = HashMap::new();
        let mut approvals: HashMap<Uuid, (Value, tokio::time::Instant)> = HashMap::new();
        loop {
            let approval_deadline = approvals
                .values()
                .map(|(_, deadline)| *deadline)
                .min()
                .unwrap_or_else(|| tokio::time::Instant::now() + Duration::from_secs(900));
            let v = if let Some(v) = w.pending.pop_front() {
                v
            } else {
                tokio::select! {
                  v=w.line()=>v?,
                  control=controls.recv()=>{match control{
                   Some(Control::Cancel)=>{w.next+=1;w.write(json!({"id":w.next,"method":"turn/interrupt","params":{"threadId":thread,"turnId":turn}})).await?;}
                   Some(Control::Decision{approval_id,accept})=>{if let Some((request,_))=approvals.remove(&approval_id){w.write(json!({"id":request,"result":{"decision":if accept{"accept"}else{"decline"}}})).await?;}}
                   None=>return Err(fail("consumer_closed","Chat control channel closed",true))
                  }continue;}
                  _=tokio::time::sleep_until(approval_deadline)=>return Err(fail("provider_timeout","No provider activity for fifteen minutes",true))
                }
            };
            let method = v["method"].as_str().unwrap_or("");
            let p = &v["params"];
            if v.get("method").is_some() && v.get("id").is_some() {
                let kind = match method {
                    "item/commandExecution/requestApproval" => {
                        if p["networkApprovalContext"].is_object() {
                            "network"
                        } else {
                            "command"
                        }
                    }
                    "item/fileChange/requestApproval" => "file_change",
                    _ => {
                        w.write(json!({"id":v["id"],"error":{"code":-32601,"message":"This interaction is not supported by Bee Team yet"}})).await?;
                        return Err(fail(
                            "unsupported_capability",
                            "Provider requested an unsupported interaction",
                            true,
                        ));
                    }
                };
                if p["threadId"] != thread || p["turnId"] != turn {
                    return Err(fail(
                        "destination_mismatch",
                        "Approval targets another turn",
                        true,
                    ));
                }
                let aid = Uuid::now_v7();
                approvals.insert(
                    aid,
                    (
                        v["id"].clone(),
                        tokio::time::Instant::now() + Duration::from_secs(900),
                    ),
                );
                emit(
                    &events,
                    IntegratedEvent::Approval {
                        approval_id: aid,
                        kind: kind.into(),
                        title: "Codex requests approval".into(),
                        description: p["reason"]
                            .as_str()
                            .unwrap_or("Review the requested action before continuing.")
                            .chars()
                            .take(4096)
                            .collect(),
                        command: p["command"].as_str().map(str::to_owned),
                        host: p["networkApprovalContext"]["host"]
                            .as_str()
                            .map(str::to_owned),
                        paths: approval_paths(p, &changed_files),
                    },
                )
                .await?;
                continue;
            }
            if p["threadId"] != thread {
                continue;
            }
            if let Some(t) = p["turnId"].as_str() {
                if t != turn {
                    continue;
                }
            }
            if matches!(method, "item/started" | "item/updated" | "item/completed")
                && p["item"]["type"] == "fileChange"
            {
                if let Some(id) = p["item"]["id"].as_str() {
                    let paths = p["item"]["changes"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|c| c["path"].as_str().map(str::to_owned))
                        .collect();
                    changed_files.insert(id.to_owned(), paths);
                }
            }
            match method {
                "item/agentMessage/delta" => {
                    let item = p["itemId"].as_str().unwrap_or("message").to_owned();
                    if !texts.iter().any(|(id, _)| id == &item) {
                        texts.push((item.clone(), String::new()));
                    }
                    texts
                        .iter_mut()
                        .find(|(id, _)| id == &item)
                        .unwrap()
                        .1
                        .push_str(p["delta"].as_str().unwrap_or(""));
                    let text = texts
                        .iter()
                        .map(|(_, text)| text.clone())
                        .collect::<Vec<_>>()
                        .join("\n\n");
                    if text.len() > 1024 * 1024 {
                        return Err(fail("reply_too_large", "Response exceeds one MiB", true));
                    }
                    if last_emit.elapsed() >= Duration::from_millis(100) {
                        emit(&events, IntegratedEvent::Text(text)).await?;
                        last_emit = std::time::Instant::now();
                    }
                }
                "item/completed" if p["item"]["type"] == "agentMessage" => {
                    let item = p["item"]["id"].as_str().unwrap_or("message").to_owned();
                    let text = p["item"]["text"].as_str().unwrap_or("").to_owned();
                    if let Some((_, value)) = texts.iter_mut().find(|(id, _)| id == &item) {
                        *value = text;
                    } else {
                        texts.push((item, text));
                    }
                    emit(
                        &events,
                        IntegratedEvent::Text(
                            texts
                                .iter()
                                .map(|(_, text)| text.clone())
                                .collect::<Vec<_>>()
                                .join("\n\n"),
                        ),
                    )
                    .await?;
                }
                "turn/completed" => {
                    if p["turn"]["id"] != turn {
                        return Err(fail(
                            "destination_mismatch",
                            "Completion targets another turn",
                            true,
                        ));
                    }
                    match p["turn"]["status"].as_str() {
                        Some("completed") => emit(&events, IntegratedEvent::Completed).await?,
                        Some("interrupted") => emit(&events, IntegratedEvent::Cancelled).await?,
                        _ => return Err(fail("turn_failed", "Codex turn failed", false)),
                    }
                    return Ok(());
                }
                "item/completed" if is_tool_item(p["item"]["type"].as_str().unwrap_or("")) => {
                    emit(
                        &events,
                        IntegratedEvent::Tool {
                            name: p["item"]["type"].as_str().unwrap_or("tool").into(),
                            summary: "Tool operation finished.".into(),
                        },
                    )
                    .await?;
                }
                _ => {}
            }
        }
    }
}
async fn emit(
    tx: &mpsc::Sender<IntegratedEvent>,
    e: IntegratedEvent,
) -> Result<(), SessionFailure> {
    tx.send(e)
        .await
        .map_err(|_| fail("consumer_closed", "Chat event consumer closed", true))
}
impl IntegratedProvider for CodexIntegratedProvider {
    fn reconcile<'a>(
        &'a self,
        target: &'a SessionDestination,
        provider_turn_id: &'a str,
        _profile: &'a Value,
    ) -> ProviderFuture<'a, ReconciledTurn> {
        Box::pin(self.reconcile_native(target, provider_turn_id))
    }
    fn validate(&self, root: &str, profile: &Value) -> Result<(), SessionFailure> {
        validate_root(root)?;
        McpScope::with_tools(
            &self.mcp_endpoint,
            "beeteam_validation",
            self.selected_profile(profile)?,
        )?;
        Ok(())
    }
    fn create<'a>(&'a self, root: &'a str, profile: &'a Value) -> ProviderFuture<'a, String> {
        Box::pin(async move {
            let (mut wire, id, _scope, _disabled_plugins) =
                self.session(root, None, profile).await?;
            // Codex defers the empty rollout until a persisted mutation. Naming an
            // owned thread materializes it without sending a synthetic model turn.
            wire.request(
                "thread/name/set",
                json!({"threadId":id,"name":"Bee Team integrated agent"}),
            )
            .await?;
            Ok(id)
        })
    }
    fn run<'a>(
        &'a self,
        target: &'a SessionDestination,
        text: &'a str,
        profile: &'a Value,
        events: mpsc::Sender<IntegratedEvent>,
        controls: mpsc::Receiver<Control>,
    ) -> ProviderFuture<'a, ()> {
        Box::pin(self.execute(target, text, profile, events, controls))
    }
    fn inspect<'a>(
        &'a self,
        target: &'a SessionDestination,
        profile: &'a Value,
    ) -> ProviderFuture<'a, Value> {
        Box::pin(async move {
            let selected = self.selected_profile(profile)?;
            let mut w = Wire::open(&self.executable, &target.project_root).await?;
            let account = w
                .request("account/read", json!({"refreshToken":false}))
                .await?;
            let ready = account["account"].is_object() || account["requiresOpenaiAuth"] == false;
            if !selected.skill_roots.is_empty() {
                w.request(
                    "skills/extraRoots/set",
                    json!({"extraRoots":selected.skill_roots}),
                )
                .await?;
            }
            let listed = w
                .request(
                    "skills/list",
                    json!({"cwds":[target.project_root],"forceReload":false}),
                )
                .await?;
            let skills=listed["data"].as_array().into_iter().flatten().flat_map(|group|group["skills"].as_array().into_iter().flatten()).map(|s|json!({"id":s["path"],"name":s["name"],"enabled":s["enabled"].as_bool().unwrap_or(true),"available":true})).collect::<Vec<_>>();
            let inventory = w.inventory(None).await?;
            let servers=selected.enabled_mcp_servers.iter().map(|name|{let server=inventory.iter().find(|s|s["name"]==*name);json!({"id":name,"name":name,"enabled":true,"status":match server.and_then(|s|s["runtimeStatus"].as_str()){Some("connected")=>"connected",Some("disabled")=>"disabled",_=>"failed"}})}).collect::<Vec<_>>();
            Ok(
                json!({"readiness":if ready{"ready"}else{"needs_auth"},"tools":{"webSearch":selected.web_search,"networkAccess":selected.network_access,"skills":skills,"mcpServers":servers}}),
            )
        })
    }
    fn tools(&self) -> Value {
        json!({"webSearch":self.profile.web_search,"networkAccess":self.profile.network_access,"skills":[],"mcpServers":[]})
    }
}

fn approval_paths(params: &Value, files: &HashMap<String, Vec<String>>) -> Vec<String> {
    let mut paths = params["itemId"]
        .as_str()
        .and_then(|id| files.get(id))
        .cloned()
        .unwrap_or_default();
    if let Some(root) = params["grantRoot"].as_str() {
        if !paths.iter().any(|p| p == root) {
            paths.push(root.to_owned());
        }
    }
    paths
}
#[cfg(test)]
mod approval_tests {
    use super::*;
    #[test]
    fn previews_file_paths_even_without_grant_root() {
        let cache = HashMap::from([("item".to_owned(), vec!["/workspace/a.rs".to_owned()])]);
        assert_eq!(
            approval_paths(&json!({"itemId":"item","grantRoot":null}), &cache),
            vec!["/workspace/a.rs"]
        );
        assert_eq!(
            approval_paths(&json!({"itemId":"item","grantRoot":"/workspace"}), &cache),
            vec!["/workspace/a.rs", "/workspace"]
        );
    }
}

fn is_tool_item(kind: &str) -> bool {
    matches!(
        kind,
        "commandExecution"
            | "fileChange"
            | "mcpToolCall"
            | "dynamicToolCall"
            | "collabAgentToolCall"
            | "webSearch"
            | "imageView"
            | "imageGeneration"
            | "sleep"
    )
}
#[cfg(test)]
mod tool_item_tests {
    use super::*;
    #[test]
    fn conversation_and_reasoning_items_are_not_tools() {
        for kind in [
            "userMessage",
            "agentMessage",
            "reasoning",
            "plan",
            "contextCompaction",
        ] {
            assert!(!is_tool_item(kind));
        }
        for kind in ["webSearch", "mcpToolCall", "commandExecution", "fileChange"] {
            assert!(is_tool_item(kind));
        }
    }
}
