use super::backend::{Failure, Result};
use serde::{Deserialize, Serialize};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartVoice {
    pub sdp: String,
}
#[derive(Serialize)]
pub struct VoiceSession {
    pub id: String,
    pub sdp: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceEvent {
    pub cursor: u64,
    pub r#type: String,
    pub call_id: Option<String>,
    pub content: Option<String>,
    pub role: Option<String>,
}
#[derive(Serialize)]
pub struct VoiceEvents {
    pub events: Vec<VoiceEvent>,
    pub cursor: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VoiceResult {
    pub call_id: String,
    pub content: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VoiceContext {
    pub content: String,
}
pub fn validate_text(text: &str, limit: usize) -> Result<()> {
    if text.trim().is_empty() || text.len() > limit || text.contains('\0') {
        return Err(Failure::invalid(
            "Voice input is empty or exceeds its limit",
        ));
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct VoiceCursor {
    #[serde(default)]
    pub after: u64,
}
