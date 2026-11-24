//! Per-turn execution access policy.
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessMode {
    ReadOnly,
    #[default]
    Standard,
    FullAccess,
    CodexConfig,
}

impl AccessMode {
    pub fn from_record(
        value: Option<&serde_json::Value>,
    ) -> Result<Option<Self>, serde_json::Error> {
        value
            .map(|value| serde_json::from_value(value.clone()))
            .transpose()
    }
}

pub fn present<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<AccessMode>, D::Error> {
    AccessMode::deserialize(deserializer).map(Some)
}
