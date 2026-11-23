//! Persist final voice text without creating an execution request.
use super::*;
use crate::dto::voice::{StartVoice, VoiceEvent, validate_text};

impl ManagedAgentService {
    pub async fn prepare_voice_conversation(&self, body: &StartVoice) -> Result<Uuid> {
        if self.provider.is_none() {
            return Err(Failure::new(
                "provider_unavailable",
                "Configure local Codex before starting voice",
            ));
        }
        for id in [Some(body.agent_id), body.team_id, body.conversation_id]
            .into_iter()
            .flatten()
        {
            if id.get_version_num() != 7 {
                return Err(Failure::invalid(
                    "Voice context requires UUIDv7 identifiers",
                ));
            }
        }
        let request = SendAgentRequest {
            content: "Voice conversation".into(),
            access_mode: None,
            conversation_id: body.conversation_id,
            task_id: None,
            team_id: body.team_id,
            board_id: None,
        };
        let mut unit = self.store.begin().await?;
        let conversation = prepare_conversation::prepare(
            &mut unit.records,
            body.agent_id,
            &request,
            &self.installation,
        )?;
        if let Some(team) = conversation.reference("teamId") {
            sessions::team_leader(&unit.records, team, body.agent_id)?;
        }
        if body.conversation_id.is_none() {
            unit.records
                .get_mut("managed_conversations", conversation.id)?
                .data["voiceTitlePending"] = json!(true);
        }
        unit.commit().await?;
        Ok(conversation.id)
    }

    pub async fn persist_voice_transcripts(
        &self,
        conversation: Uuid,
        session: &str,
        events: &[VoiceEvent],
    ) -> Result<()> {
        let transcripts: Vec<_> = events
            .iter()
            .filter(|event| {
                event.r#type == "transcript"
                    && matches!(event.role.as_deref(), Some("user" | "assistant"))
                    && event
                        .content
                        .as_ref()
                        .is_some_and(|text| !text.trim().is_empty())
            })
            .collect();
        if transcripts.is_empty() {
            return Ok(());
        }
        let mut unit = self.store.begin().await?;
        // The validated binding stays on its original conversation if leadership changes mid-call.
        unit.records.get("managed_conversations", conversation)?;
        for event in transcripts {
            let content = event.content.as_ref().unwrap();
            validate_text(content, 65536)?;
            let role = if event.role.as_deref() == Some("user") {
                "requester"
            } else {
                "agent"
            };
            let existing = unit
                .records
                .list("managed_messages")
                .into_iter()
                .find(|message| {
                    message.data["voiceSessionId"] == session
                        && message.data["voiceCursor"] == event.cursor
                });
            if let Some(existing) = existing {
                if existing.reference("conversationId") != Some(conversation)
                    || existing.data["content"] != *content
                    || existing.data["role"] != role
                {
                    return Err(Failure::new(
                        "idempotency_conflict",
                        "Voice transcript event changed after persistence",
                    ));
                }
                continue;
            }
            unit.records.insert(Record::new("managed_messages", json!({
                "conversationId": conversation, "requestId": null, "role": role,
                "source": "voice", "content": content, "voiceSessionId": session, "voiceCursor": event.cursor
            })));
            let row = unit
                .records
                .get_mut("managed_conversations", conversation)?;
            if role == "requester" && row.data["voiceTitlePending"] == true {
                if row.data["title"] == "Voice conversation" {
                    row.data["title"] = json!(content.chars().take(60).collect::<String>());
                }
                row.data
                    .as_object_mut()
                    .unwrap()
                    .remove("voiceTitlePending");
            }
            row.touch();
        }
        unit.commit().await
    }
}
