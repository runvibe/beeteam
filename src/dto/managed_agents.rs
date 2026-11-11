//! Managed-agent contracts shared by HTTP, MCP, and the owned runtime.
//! Public requests never select provider threads or assign external sessions.
use crate::dto::backend::{Failure, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamManagedApproval {
    pub approval: serde_json::Value,
    pub request: serde_json::Value,
    pub agent: ManagedApprovalAgent,
}

#[derive(Debug, Serialize)]
pub struct ManagedApprovalAgent {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SendAgentRequest {
    pub content: String,
    #[serde(default, deserialize_with = "optional_uuid")]
    pub conversation_id: Option<Uuid>,
    #[serde(default, deserialize_with = "optional_uuid")]
    pub task_id: Option<Uuid>,
    /// Team whose leader session this new conversation belongs to.
    #[serde(default, deserialize_with = "optional_uuid", skip_serializing_if = "Option::is_none")]
    pub team_id: Option<Uuid>,
    /// Optional board context of the team session.
    #[serde(default, deserialize_with = "optional_uuid", skip_serializing_if = "Option::is_none")]
    pub board_id: Option<Uuid>,
}
pub(crate) fn optional_uuid<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<Uuid>, D::Error> {
    let value = Option::<String>::deserialize(deserializer)?;
    value
        .map(|text| {
            let id = Uuid::parse_str(&text).map_err(serde::de::Error::custom)?;
            if !text.eq_ignore_ascii_case(&id.hyphenated().to_string()) {
                return Err(serde::de::Error::custom(
                    "UUID must use canonical hyphenated form",
                ));
            }
            Ok(id)
        })
        .transpose()
}
impl SendAgentRequest {
    pub fn validate(&self) -> Result<()> {
        if self.content.trim().is_empty() || self.content.contains('\0') {
            return Err(Failure::invalid("content must contain text and no NUL"));
        }
        if self.content.len() > 65536 {
            return Err(Failure::new(
                "payload_too_large",
                "content exceeds 65536 UTF-8 bytes",
            ));
        }
        if self.board_id.is_some() && self.team_id.is_none() {
            return Err(Failure::invalid("boardId requires teamId"));
        }
        for id in [self.conversation_id, self.task_id, self.team_id, self.board_id]
            .into_iter()
            .flatten()
        {
            if id.get_version_num() != 7 || id.get_variant() != uuid::Variant::RFC4122 {
                return Err(Failure::invalid("Bee Team references must be UUIDv7"));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Codex,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WebSearch {
    Live,
    Cached,
    Disabled,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ToolProfile {
    pub web_search: WebSearch,
    pub network_access: bool,
    pub enabled_mcp_servers: Vec<String>,
    pub skill_roots: Vec<String>,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExecutionConfiguration {
    pub provider: Provider,
    pub tool_profile: ToolProfile,
}
impl ExecutionConfiguration {
    pub fn validate(&self) -> Result<()> {
        let profile = &self.tool_profile;
        if profile.enabled_mcp_servers.len() > 64 || profile.skill_roots.len() > 16 {
            return Err(Failure::invalid(
                "tool profile exceeds configured list limits",
            ));
        }
        for name in &profile.enabled_mcp_servers {
            if name.is_empty()
                || name.len() > 128
                || !name
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
            {
                return Err(Failure::invalid(
                    "MCP names must be configured names, not credentials or URLs",
                ));
            }
        }
        for path in &profile.skill_roots {
            absolute_path(path)?;
        }
        for list in [&profile.enabled_mcp_servers, &profile.skill_roots] {
            let mut unique = std::collections::HashSet::new();
            if !list.iter().all(|item| unique.insert(item)) {
                return Err(Failure::invalid("tool profile lists must be unique"));
            }
        }
        Ok(())
    }
}
fn absolute_path(value: &str) -> Result<()> {
    let bytes = value.as_bytes();
    if value.trim() != value
        || value.is_empty()
        || value.len() > 4096
        || value.contains(['\0', '\r', '\n'])
    {
        return Err(Failure::invalid(
            "path must be nonblank, bounded and have no surrounding whitespace or control lines",
        ));
    }
    if value.starts_with('/')
        || value.starts_with("\\\\")
        || (bytes.len() > 2
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && matches!(bytes[2], b'/' | b'\\'))
    {
        Ok(())
    } else {
        Err(Failure::invalid(
            "path must be absolute on the runtime host",
        ))
    }
}
