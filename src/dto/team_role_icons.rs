//! Trusted representations shared by HTTP, MCP and the frontend.
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TeamRoleIcon {
    pub id: String,
    pub name: String,
    pub unicode: String,
    pub svg: String,
}

pub static CATALOG: LazyLock<Vec<TeamRoleIcon>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../docs/team-role-icons.json"))
        .expect("valid bundled team role icons")
});

pub const LEADER_DEFAULT: &str = "crown";
pub const COLLABORATOR_DEFAULT: &str = "user-round";

pub fn icon(id: &str) -> Option<&'static TeamRoleIcon> {
    CATALOG.iter().find(|icon| icon.id == id)
}
