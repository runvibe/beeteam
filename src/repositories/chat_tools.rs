//! Local configuration of tools available to team chats.
use crate::dto::{
    managed_agents::{ExecutionConfiguration, Provider, ToolProfile, WebSearch},
    session_delivery::SessionFailure,
};
use serde::Deserialize;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
pub struct ChatTools {
    pub enabled_mcp_servers: Vec<String>,
    pub skill_roots: Vec<String>,
}

pub fn read(path: &Path) -> Result<ChatTools, SessionFailure> {
    let file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ChatTools::default())
        }
        Err(_) => return Err(invalid()),
    };
    let mut bytes = Vec::new();
    file.take(65537)
        .read_to_end(&mut bytes)
        .map_err(|_| invalid())?;
    if bytes.len() > 65536 {
        return Err(invalid());
    }
    let text = std::str::from_utf8(&bytes).map_err(|_| invalid())?;
    let selection: ChatTools = toml::from_str(text).map_err(|_| invalid())?;
    ExecutionConfiguration {
        provider: Provider::Codex,
        tool_profile: ToolProfile {
            web_search: WebSearch::Live,
            network_access: true,
            enabled_mcp_servers: selection.enabled_mcp_servers.clone(),
            skill_roots: selection.skill_roots.clone(),
        },
    }
    .validate()
    .map_err(|_| invalid())?;
    Ok(selection)
}

pub fn local() -> Result<ChatTools, SessionFailure> {
    let home = std::env::home_dir().ok_or_else(invalid)?;
    read(&home.join(".beeteam").join("chat-tools.toml"))
}

pub fn apply(profile: &mut super::codex_mcp_scope::CodexToolProfile, selection: ChatTools) {
    profile.enabled_mcp_servers = selection.enabled_mcp_servers;
    profile.skill_roots = selection.skill_roots;
}

fn invalid() -> SessionFailure {
    SessionFailure::new(
        "chat_tools_config_invalid",
        "Cannot read ~/.beeteam/chat-tools.toml",
        false,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_local_selection_and_rejects_bad_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("chat-tools.toml");
        assert_eq!(read(&path).unwrap(), ChatTools::default());
        std::fs::write(
            &path,
            "enabledMcpServers = [\"docs\"]\nskillRoots = [\"/skills\"]\n",
        )
        .unwrap();
        assert_eq!(
            read(&path).unwrap(),
            ChatTools {
                enabled_mcp_servers: vec!["docs".into()],
                skill_roots: vec!["/skills".into()],
            }
        );
        let mut profile = super::super::codex_mcp_scope::CodexToolProfile {
            enabled_mcp_servers: vec!["old".into()],
            skill_roots: vec!["/old".into()],
            network_access: false,
            ..Default::default()
        };
        apply(&mut profile, read(&path).unwrap());
        assert_eq!(profile.enabled_mcp_servers, ["docs"]);
        assert_eq!(profile.skill_roots, ["/skills"]);
        assert!(!profile.network_access);
        std::fs::write(&path, "enabledMcpServers = [false]").unwrap();
        assert_eq!(read(&path).unwrap_err().code, "chat_tools_config_invalid");
        std::fs::write(&path, "enabledMcpServer = []").unwrap();
        assert_eq!(read(&path).unwrap_err().code, "chat_tools_config_invalid");
        std::fs::write(&path, "skillRoots = [\"relative\"]").unwrap();
        assert_eq!(read(&path).unwrap_err().code, "chat_tools_config_invalid");
        std::fs::write(&path, "enabledMcpServers = [\"https://example.com\"]").unwrap();
        assert_eq!(read(&path).unwrap_err().code, "chat_tools_config_invalid");
    }
}
