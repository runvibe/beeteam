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
    pub fn is_standard(&self) -> bool {
        *self == Self::Standard
    }

    pub fn from_record(value: Option<&serde_json::Value>) -> Result<Self, serde_json::Error> {
        match value {
            None => Ok(Self::Standard),
            Some(value) => serde_json::from_value(value.clone()),
        }
    }
}
