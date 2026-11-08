//! Per-thread MCP containment. Inventory metadata only; no auth/config secrets.
use crate::dto::session_delivery::SessionFailure;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;

/// Explicit local provider configuration; contains no credentials or commands.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields, default)]
pub struct CodexToolProfile {
    pub web_search: String,
    pub network_access: bool,
    pub enabled_mcp_servers: Vec<String>,
    pub skill_roots: Vec<String>,
}
impl Default for CodexToolProfile {
    fn default() -> Self {
        Self {
            web_search: "live".into(),
            network_access: true,
            enabled_mcp_servers: vec![],
            skill_roots: vec![],
        }
    }
}
pub struct McpScope {
    endpoint: String,
    origin: String,
    name: String,
    configuration: Value,
    profile: Option<CodexToolProfile>,
}
/// Missing/malformed pagination metadata is not evidence of a complete inventory.
pub fn inventory_cursor(result: &Value) -> Result<Option<&str>, SessionFailure> {
    match result.get("nextCursor") {
        Some(Value::Null) => Ok(None),
        Some(Value::String(cursor)) if !cursor.is_empty() => Ok(Some(cursor)),
        _ => Err(fail()),
    }
}
impl McpScope {
    pub fn new(endpoint: &str, name: &str) -> Result<Self, SessionFailure> {
        let url = url::Url::parse(endpoint).map_err(|_| fail())?;
        let local = match url.host() {
            Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
            Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
            _ => false,
        };
        if url.scheme() != "http"
            || !local
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err(fail());
        }
        let mut configuration = json!({"mcp_servers":{},"plugins":{},"features.apps":false});
        configuration["mcp_servers"][name] =
            json!({"url":endpoint,"enabled":true,"required":true,"startup_timeout_sec":15});
        Ok(Self {
            endpoint: endpoint.into(),
            origin: url.origin().ascii_serialization(),
            name: name.into(),
            configuration,
            profile: None,
        })
    }
    pub fn with_tools(
        endpoint: &str,
        name: &str,
        profile: CodexToolProfile,
    ) -> Result<Self, SessionFailure> {
        if !matches!(profile.web_search.as_str(), "live" | "cached" | "disabled")
            || profile.enabled_mcp_servers.len() > 100
            || profile.skill_roots.len() > 32
            || profile.enabled_mcp_servers.iter().any(|s| {
                s.trim().is_empty()
                    || s.trim() != s
                    || s.contains('\0')
                    || s == name
                    || s == "codex_apps"
            })
            || profile
                .skill_roots
                .iter()
                .any(|s| s.contains('\0') || !std::path::Path::new(s).is_absolute())
        {
            return Err(SessionFailure::new(
                "invalid_tool_profile",
                "Invalid Codex tool profile",
                false,
            ));
        }
        let mut scope = Self::new(endpoint, name)?;
        scope.configuration["web_search"] = json!(profile.web_search);
        scope.configuration["sandbox_workspace_write.network_access"] =
            json!(profile.network_access);
        scope.profile = Some(profile);
        Ok(scope)
    }
    pub fn skill_roots(&self) -> &[String] {
        self.profile
            .as_ref()
            .map(|p| p.skill_roots.as_slice())
            .unwrap_or(&[])
    }
    fn selected(&self, name: &str) -> bool {
        self.profile
            .as_ref()
            .is_some_and(|p| p.enabled_mcp_servers.iter().any(|s| s == name))
    }
    pub fn observe(&mut self, servers: &[Value]) -> Result<(), SessionFailure> {
        if let Some(profile) = &self.profile {
            for name in &profile.enabled_mcp_servers {
                let server = servers
                    .iter()
                    .find(|s| s["name"] == *name)
                    .ok_or_else(fail)?;
                // Plugin activation can enable several MCPs. Require explicit
                // selection of every sibling rather than silently broadening it.
                if let Some(plugin) = server["pluginId"].as_str() {
                    if servers.iter().any(|s| {
                        s["pluginId"] == plugin && !self.selected(s["name"].as_str().unwrap_or(""))
                    }) {
                        return Err(fail());
                    }
                }
            }
        }
        for server in servers {
            let name = server["name"].as_str().ok_or_else(fail)?;
            if name == self.name {
                return Err(fail());
            }
            if self.selected(name) {
                // Keep the configured transport and provider-owned credentials.
                // Never copy environment/header/token values into our config.
                if let Some(plugin) = server["pluginId"].as_str() {
                    self.configuration["plugins"][plugin] = json!({"enabled":true});
                }
                continue;
            }
            if let Some(plugin) = server["pluginId"].as_str() {
                self.configuration["plugins"][plugin] = json!({"enabled":false});
            } else if name != "codex_apps" {
                // CLI-injected servers may have no base-file transport after
                // resume overrides. Use an inert, explicitly disabled transport;
                // never read/copy their command, environment, headers or tokens.
                self.configuration["mcp_servers"][name] = if server["httpOrigin"].is_string() {
                    json!({"url":"http://127.0.0.1:0/disabled","enabled":false,"required":false})
                } else {
                    json!({"command":"beeteam-disabled-mcp","args":[],"enabled":false,"required":false})
                };
            }
        }
        Ok(())
    }
    pub fn configuration(&self) -> Value {
        self.configuration.clone()
    }
    pub fn origin(&self) -> &str {
        &self.origin
    }
    pub fn disabled_plugins(&self, servers: &[Value]) -> Vec<String> {
        let mut ids = std::collections::BTreeSet::new();
        for server in servers {
            if let Some(id) = server["pluginId"].as_str() {
                if !self.selected(server["name"].as_str().unwrap_or("")) {
                    ids.insert(id.to_owned());
                }
            }
        }
        ids.into_iter().collect()
    }
    pub fn context(&self) -> String {
        format!("Bee Team instance MCP: {}. Use only MCP server {} for Bee Team operations and Conversation. Other chat messaging is outside this managed channel.\n\n",self.endpoint,self.name)
    }
    pub fn verify(&self, servers: &[Value]) -> Result<(), SessionFailure> {
        let mut found = false;
        let mut verified_selected = BTreeSet::new();
        for server in servers {
            let tools = server["tools"].as_object();
            if server["name"] == self.name {
                if server["httpOrigin"] != self.origin
                    || server["runtimeStatus"] != "connected"
                    || !server["toolsError"].is_null()
                    || !tools.is_some_and(|t| {
                        ["getTask", "createComment", "createExecutionSummary"]
                            .iter()
                            .all(|name| t.contains_key(*name))
                    })
                {
                    return Err(fail());
                }
                found = true;
            } else if self.selected(server["name"].as_str().unwrap_or("")) {
                if server["runtimeStatus"] != "connected"
                    || !server["toolsError"].is_null()
                    || tools.is_none_or(|t| t.is_empty() || t.keys().any(|name| forbidden(name)))
                {
                    return Err(fail());
                }
                verified_selected.insert(server["name"].as_str().unwrap());
            } else if server["runtimeStatus"] == "disabled" {
                continue;
            } else {
                // Dynamic unrelated plugins may remain; never permit a foreign
                // Bee Team or harness-chat tool catalog to reach inference.
                // The provider must also pass disabled_plugins() to turn/start:
                // Codex can keep plugin catalogs connected despite enabled=false.
                if !server["pluginId"].is_string()
                    || server["runtimeStatus"] != "connected"
                    || !server["toolsError"].is_null()
                    || tools.is_none_or(|t| t.is_empty())
                    || tools.unwrap().keys().any(|name| forbidden(name))
                {
                    return Err(fail());
                }
            }
        }
        let selection_complete = self.profile.as_ref().is_none_or(|p| {
            p.enabled_mcp_servers
                .iter()
                .all(|name| verified_selected.contains(name.as_str()))
        });
        if found && selection_complete {
            Ok(())
        } else {
            Err(fail())
        }
    }
}
fn forbidden(name: &str) -> bool {
    let name = name.rsplit("__").next().unwrap_or(name);
    crate::dto::contracts::OPERATIONS
        .iter()
        .any(|op| op.name == name)
        || crate::dto::mcp::is_composite(name)
        || crate::dto::integrated_chat_tools::NAMES.contains(&name)
        || crate::dto::data_transfer_tools::NAMES.contains(&name)
        || matches!(
            name,
            "send_message_to_thread"
                | "create_thread"
                | "fork_thread"
                | "handoff_thread"
                | "followup_task"
        )
}
fn fail() -> SessionFailure {
    SessionFailure::new(
        "mcp_scope_unverified",
        "Cannot verify a Bee Team MCP connection pinned to this local instance",
        false,
    )
}
