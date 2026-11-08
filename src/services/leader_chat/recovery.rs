//! Explicit read-only provider reconciliation; never submits another turn.
use super::{rules, LeaderChatService};
use crate::{
    dto::{
        backend::{Command, Failure, Outcome, Result},
        session_delivery::SessionDestination,
    },
    repositories::{
        integrated_provider::{ReconciledStatus, ReconciledTurn},
        records::{Record, Records},
    },
};
use serde_json::{json, Value};
impl LeaderChatService {
    pub async fn reconcile(&self, c: Command) -> Result<Outcome> {
        self.recover().await?;
        let actor = c.actor()?;
        actor.validate()?;
        let key = c
            .idempotency_key
            .ok_or_else(|| Failure::invalid("Idempotency-Key required"))?;
        let id = c.id("turnId")?;
        let chat = c.id("chatId")?;
        let op = format!("integrated:reconcile:{chat}:{id}");
        let hash =
            serde_json::to_string(&json!({"version":c.expected_version,"body":c.body})).unwrap();
        let mut u = self.store.begin().await?;
        if let Some(actor_id) = actor.id {
            u.records.get("agents", actor_id)?;
        }
        if let Some(out) = u.replay(&actor.key(), &op, key, &hash).await? {
            u.rollback().await?;
            return Ok(out);
        }
        let (turn, binding) = validate(&u.records, &c, &self.installation)?;
        let provider_id = turn.data["providerTurnId"].as_str().map(str::to_owned);
        u.rollback().await?;
        let observed = if let Some(provider_id) = provider_id.as_deref() {
            let target: SessionDestination = serde_json::from_value(binding.data.clone())
                .map_err(|e| Failure::invalid(e.to_string()))?;
            let provider = self.provider.as_ref().ok_or_else(|| {
                Failure::new("session_not_ready", "Integrated provider unavailable")
            })?;
            provider
                .reconcile(&target, provider_id, &binding.data["toolProfile"])
                .await
                .map_err(|e| Failure::new(e.code, e.message))?
        } else {
            ReconciledTurn {
                status: ReconciledStatus::Unknown,
                text: None,
            }
        };
        let mut u = self.store.begin().await?;
        if let Some(out) = u.replay(&actor.key(), &op, key, &hash).await? {
            u.rollback().await?;
            return Ok(out);
        }
        let (current, current_binding) = validate(&u.records, &c, &self.installation)?;
        if current_binding.id != binding.id
            || current.data["providerTurnId"] != turn.data["providerTurnId"]
        {
            return Err(Failure::new(
                "session_binding_conflict",
                "Recovery origin changed",
            ));
        }
        let resolved = apply(&mut u.records, &current, &observed)?;
        let out = Outcome::data(
            json!({"resolved":resolved,"turn":rules::project(u.records.get("leader_chat_turns",id)?)}),
        );
        u.save_replay(&actor.key(), &op, key, &hash, &out).await?;
        u.commit().await?;
        Ok(out)
    }
}
fn validate(records: &Records, c: &Command, installation: &str) -> Result<(Record, Record)> {
    let turn = records.get("leader_chat_turns", c.id("turnId")?)?.clone();
    if turn.reference("chatId") != Some(c.id("chatId")?) {
        return Err(Failure::missing());
    }
    rules::check_version(&turn, c.expected_version)?;
    if turn.data["status"] != "uncertain" {
        return Err(Failure::new(
            "turn_not_uncertain",
            "Only uncertain turns can be reconciled",
        ));
    }
    let binding = records
        .get(
            "agent_session_bindings",
            turn.reference("bindingId").ok_or_else(Failure::missing)?,
        )?
        .clone();
    if binding.data["mode"] != "integrated"
        || binding.data["installationId"] != installation
        || !binding.data["endedAt"].is_null()
    {
        return Err(Failure::new(
            "session_binding_conflict",
            "Recovery requires the original active local integrated binding",
        ));
    }
    let agent = binding.reference("agentId").ok_or_else(Failure::missing)?;
    if rules::binding(records, agent)?.id != binding.id {
        return Err(Failure::new(
            "session_binding_conflict",
            "Active binding changed",
        ));
    }
    Ok((turn, binding))
}
pub fn apply(records: &mut Records, turn: &Record, observed: &ReconciledTurn) -> Result<bool> {
    let state = match observed.status {
        ReconciledStatus::Completed => "completed",
        ReconciledStatus::Cancelled => "cancelled",
        ReconciledStatus::Failed => "failed",
        ReconciledStatus::Running | ReconciledStatus::Unknown => return Ok(false),
    };
    let text = observed.text.as_deref().unwrap_or("");
    if let Some(delivery_id) = turn.reference("sourceDeliveryId") {
        let row = records.get("session_deliveries", delivery_id)?.clone();
        if row.reference("bindingId") != turn.reference("bindingId") {
            return Err(Failure::new(
                "session_binding_conflict",
                "Delivery binding changed",
            ));
        }
        let provider_id = turn.data["providerTurnId"]
            .as_str()
            .ok_or_else(Failure::missing)?;
        if !row.data["turnId"].is_null() && row.data["turnId"] != provider_id {
            return Err(Failure::new(
                "session_binding_conflict",
                "Delivery provider turn changed",
            ));
        }
        if state == "completed" {
            if row.data["turnId"].is_null() {
                records.get_mut("session_deliveries", delivery_id)?.data["turnId"] =
                    json!(provider_id);
            }
            crate::services::managed_sessions::completion::complete(
                records,
                delivery_id,
                provider_id,
                text,
            )?;
        } else if row.data["state"] != "completed" {
            let row = records.get_mut("session_deliveries", delivery_id)?;
            row.data["state"] = json!("failed");
            row.data["errorCode"] = json!(if state == "cancelled" {
                "turn_cancelled"
            } else {
                "turn_failed"
            });
            row.touch();
        }
    }
    // Only the owner of the human chat contributes assistant messages there.
    let chat = turn
        .reference("chatId")
        .and_then(|id| records.get("leader_chats", id).ok())
        .cloned();
    if let Some(chat) = chat {
        if !text.is_empty()
            && (turn.data["sourceDeliveryId"].is_null()
                || chat.reference("leaderAgentId") == turn.reference("ownerAgentId"))
        {
            if text.len() > 1024 * 1024 {
                return Err(Failure::new(
                    "payload_too_large",
                    "Recovered response exceeds one MiB",
                ));
            }
            let old = records
                .list("leader_chat_messages")
                .into_iter()
                .find(|m| m.reference("turnId") == Some(turn.id) && m.data["role"] == "assistant")
                .map(|m| m.id);
            let task = turn.reference("taskId").or_else(|| {
                records
                    .list("leader_chat_messages")
                    .into_iter()
                    .find(|m| m.reference("turnId") == Some(turn.id) && m.data["role"] == "user")
                    .and_then(|m| m.reference("taskId"))
            });
            let mid = if let Some(mid) = old {
                let row = records.get_mut("leader_chat_messages", mid)?;
                row.data["content"] = json!(text);
                row.touch();
                mid
            } else {
                records.insert(Record::new("leader_chat_messages",json!({"chatId":chat.id,"turnId":turn.id,"role":"assistant","content":text,"taskId":task,"clientMessageId":null})))
            };
            let message = rules::visible_message(records.get("leader_chat_messages", mid)?);
            rules::event(
                records,
                chat.id,
                turn.id,
                "message.updated",
                json!({"message":message}),
            );
        }
    }
    rules::transition(
        records,
        turn.id,
        state,
        if state == "failed" {
            json!({"code":"turn_failed","message":"Provider confirmed failed turn"})
        } else {
            Value::Null
        },
    )?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recovered_human_reply_preserves_original_task_link() {
        let mut records = Records::default();
        let task = uuid::Uuid::now_v7();
        let chat = records.insert(Record::new("leader_chats", json!({})));
        let turn = Record::new(
            "leader_chat_turns",
            json!({"chatId":chat,"status":"uncertain"}),
        );
        records.insert(turn.clone());
        records.insert(Record::new("leader_chat_messages",json!({"chatId":chat,"turnId":turn.id,"role":"user","taskId":task,"content":"Inspect task"})));
        apply(
            &mut records,
            &turn,
            &ReconciledTurn {
                status: ReconciledStatus::Completed,
                text: Some("Recovered".into()),
            },
        )
        .unwrap();
        let reply = records
            .list("leader_chat_messages")
            .into_iter()
            .find(|m| m.data["role"] == "assistant")
            .unwrap();
        assert_eq!(reply.reference("taskId"), Some(task));
    }
}
