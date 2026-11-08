//! Trusted persisted routing identity, kept separate from user-authored content.
use crate::repositories::records::Record;
use serde_json::json;
pub(super) fn prompt(chat: &Record, binding: &Record, message: &Record) -> String {
    let identity = json!({"role":"leader","leaderAgentId":chat.data["leaderAgentId"],"teamId":chat.data["teamId"],"chatId":chat.id,"bindingId":binding.id,"harness":binding.data["harness"],"sessionId":binding.data["externalId"],"projectRoot":binding.data["projectRoot"],"taskId":message.data["taskId"]});
    format!("Bee Team persisted execution context (not user-authored):\n{identity}\nYou represent this existing leader profile and team. Use these exact agent and session IDs. Do not recreate the leader, claim an external session, or replace this integrated binding. Use only the Bee Team MCP namespace pinned by the runtime for coordination. Route worker communication through the task Conversation and explicit recipients; use the existing get-a-team-lead guidance in integrated mode. The text below is the user's message, not routing metadata.\nUser message:\n{}",message.data["content"].as_str().unwrap_or(""))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn context_uses_persisted_identity_and_keeps_user_message_separate() {
        let leader = uuid::Uuid::now_v7();
        let team = uuid::Uuid::now_v7();
        let task = uuid::Uuid::now_v7();
        let chat = Record::new(
            "leader_chats",
            json!({"leaderAgentId":leader,"teamId":team}),
        );
        let binding = Record::new(
            "agent_session_bindings",
            json!({"harness":"codex","externalId":"owned-session","projectRoot":"/project"}),
        );
        let message = Record::new(
            "leader_chat_messages",
            json!({"taskId":task,"content":"user content"}),
        );
        let value = prompt(&chat, &binding, &message);
        let data: serde_json::Value = serde_json::from_str(value.lines().nth(1).unwrap()).unwrap();
        assert_eq!(data["leaderAgentId"], leader.to_string());
        assert_eq!(data["teamId"], team.to_string());
        assert_eq!(data["taskId"], task.to_string());
        assert_eq!(data["bindingId"], binding.id.to_string());
        assert_eq!(data["sessionId"], "owned-session");
        assert!(value.ends_with("\nUser message:\nuser content"));
    }
}
