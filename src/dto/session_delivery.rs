//! Provider-independent local session transport contract. No credentials are persisted.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDestination {
    pub harness: String,
    pub installation_id: String,
    pub external_id: String,
    pub project_root: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SessionEvent {
    Ready { backend_origin: String },
    Accepted { turn_id: String },
    Completed { turn_id: String, text: String },
}

#[derive(Debug, Clone, thiserror::Error)]
#[error("{code}: {message}")]
pub struct SessionFailure {
    pub code: &'static str,
    pub message: String,
    /// Sending may already have reached the provider. Never blindly retry.
    pub uncertain: bool,
}
impl SessionFailure {
    pub fn new(code: &'static str, message: impl Into<String>, uncertain: bool) -> Self {
        Self {
            code,
            message: message.into(),
            uncertain,
        }
    }
}
