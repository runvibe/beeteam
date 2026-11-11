//! Bridge Conversation delivery to the integrated runtime and human approval UI.
//! The dispatcher retains ownership of canonical Conversation replies and receipts.
use super::{rules, LeaderChatService};
use crate::{
    dto::{
        backend::{Failure, Result},
        leader_chat::terminal,
        session_delivery::*,
    },
    repositories::{
        contracts::SessionProvider,
        integrated_provider::{Control, IntegratedEvent},
        records::{Record, Records},
    },
};
use serde_json::{json, Value};
use std::{future::Future, pin::Pin};
use tokio::sync::mpsc;
use uuid::Uuid;

pub struct WorkerDeliveryProvider {
    service: LeaderChatService,
    backend_origin: String,
}
impl WorkerDeliveryProvider {
    pub fn new(service: LeaderChatService, backend_origin: String) -> Self {
        Self {
            service,
            backend_origin,
        }
    }
    async fn execute(
        &self,
        target: &SessionDestination,
        text: &str,
        events: mpsc::Sender<SessionEvent>,
        delivery_id: Uuid,
    ) -> std::result::Result<(), SessionFailure> {
        self.service.recover().await.map_err(storage_failure)?;
        let provider = self
            .service
            .provider
            .as_ref()
            .ok_or_else(|| {
                SessionFailure::new(
                    "provider_unavailable",
                    "Integrated runtime is not configured",
                    false,
                )
            })?
            .clone();
        let mut u = self.service.store.begin().await.map_err(storage_failure)?;
        let turn = reserve(&mut u.records, delivery_id, target).map_err(reservation_failure)?;
        let binding = u
            .records
            .get(
                "agent_session_bindings",
                turn.reference("bindingId").unwrap(),
            )
            .map_err(storage_failure)?;
        let profile = binding.data["toolProfile"].clone();
        let mut owned_target = target.clone();
        owned_target.project_root = provider.default_workspace(binding.reference("agentId").ok_or_else(|| SessionFailure::new("invalid_request", "Missing agent", false))?)?;
        let target = &owned_target;
        let turn_id = turn.id;
        u.commit().await.map_err(storage_failure)?;
        let (control_tx, control_rx) = mpsc::channel(16);
        self.service
            .controls
            .lock()
            .await
            .insert(turn_id, control_tx);
        let result = self
            .pump(
                target, text, &profile, turn_id, events, control_rx, provider,
            )
            .await;
        self.service.controls.lock().await.remove(&turn_id);
        if let Err(e) = &result {
            if let Ok(mut u) = self.service.store.begin().await {
                let _ = rules::transition(
                    &mut u.records,
                    turn_id,
                    if e.uncertain { "uncertain" } else { "failed" },
                    json!({"code":e.code,"message":e.message}),
                );
                expire_approvals(&mut u.records, turn_id);
                let _ = u.commit().await;
            }
        }
        result
    }
    async fn pump(
        &self,
        target: &SessionDestination,
        text: &str,
        profile: &Value,
        turn_id: Uuid,
        events: mpsc::Sender<SessionEvent>,
        controls: mpsc::Receiver<Control>,
        provider: std::sync::Arc<dyn crate::repositories::integrated_provider::IntegratedProvider>,
    ) -> std::result::Result<(), SessionFailure> {
        let (tx, mut rx) = mpsc::channel(32);
        let run = provider.run(target, text, profile, tx, controls);
        tokio::pin!(run);
        let mut accepted = None;
        let mut response = String::new();
        let mut done = false;
        let mut receiving = true;
        loop {
            tokio::select! {
             next=rx.recv(),if receiving=>match next {
              Some(e)=>self.accept_event(turn_id,e,&events,&mut accepted,&mut response,&mut done).await?,
              None=>receiving=false,
             },
             outcome=&mut run=>{
              while let Ok(e)=rx.try_recv(){self.accept_event(turn_id,e,&events,&mut accepted,&mut response,&mut done).await?;}
              outcome?;
              if !done{return Err(SessionFailure::new("missing_completion","Provider ended without a completion",accepted.is_some()))}
              return Ok(())
             }
            }
        }
    }
    async fn accept_event(
        &self,
        id: Uuid,
        event: IntegratedEvent,
        events: &mpsc::Sender<SessionEvent>,
        accepted: &mut Option<String>,
        response: &mut String,
        done: &mut bool,
    ) -> std::result::Result<(), SessionFailure> {
        match event {
            IntegratedEvent::Accepted(provider_id) => {
                if accepted.is_some() {
                    return Err(SessionFailure::new(
                        "invalid_protocol",
                        "Duplicate turn acceptance",
                        true,
                    ));
                }
                let mut u = self.service.store.begin().await.map_err(storage_failure)?;
                let t = u
                    .records
                    .get_mut("leader_chat_turns", id)
                    .map_err(storage_failure)?;
                t.data["providerTurnId"] = json!(provider_id);
                t.touch();
                u.commit().await.map_err(storage_failure)?;
                *accepted = Some(provider_id.clone());
                events
                    .send(SessionEvent::Ready {
                        backend_origin: self.backend_origin.clone(),
                    })
                    .await
                    .map_err(consumer_failure)?;
                events
                    .send(SessionEvent::Accepted {
                        turn_id: provider_id,
                    })
                    .await
                    .map_err(consumer_failure)?;
            }
            IntegratedEvent::Text(text) => *response = text,
            IntegratedEvent::Approval {
                approval_id,
                kind,
                title,
                description,
                command,
                host,
                paths,
            } => {
                let mut u = self.service.store.begin().await.map_err(storage_failure)?;
                let turn = u
                    .records
                    .get("leader_chat_turns", id)
                    .map_err(storage_failure)?
                    .clone();
                let chat=turn.reference("chatId").ok_or_else(||SessionFailure::new("approval_required","This worker needs a human approval, but its leader has no integrated chat. No action was approved.",true))?;
                let binding = u
                    .records
                    .get(
                        "agent_session_bindings",
                        turn.reference("bindingId").unwrap(),
                    )
                    .map_err(storage_failure)?;
                if !binding.data["endedAt"].is_null() {
                    return Err(SessionFailure::new(
                        "session_binding_conflict",
                        "Worker binding changed before approval",
                        true,
                    ));
                }
                let mut approval = Record::new(
                    "leader_chat_approvals",
                    json!({"chatId":chat,"turnId":id,"bindingId":turn.data["bindingId"],"agentId":turn.data["ownerAgentId"],"taskId":turn.data["taskId"],"kind":kind,"title":title,"description":description,"command":command,"host":host,"paths":paths,"status":"pending","expiresAt":chrono::Utc::now()+chrono::Duration::minutes(15)}),
                );
                approval.id = approval_id;
                let value = rules::project(&approval);
                u.records.insert(approval);
                rules::transition(&mut u.records, id, "waiting_approval", Value::Null)
                    .map_err(storage_failure)?;
                rules::event(
                    &mut u.records,
                    chat,
                    id,
                    "approval.updated",
                    json!({"approval":value}),
                );
                u.commit().await.map_err(storage_failure)?;
            }
            IntegratedEvent::Completed => {
                let provider_id = accepted.as_ref().ok_or_else(|| {
                    SessionFailure::new(
                        "invalid_protocol",
                        "Completion arrived before acceptance",
                        true,
                    )
                })?;
                if response.len() > 16384 {
                    return Err(SessionFailure::new(
                        "reply_too_large",
                        "Conversation reply exceeds 16384 UTF-8 bytes",
                        true,
                    ));
                }
                let mut u = self.service.store.begin().await.map_err(storage_failure)?;
                let turn = u
                    .records
                    .get("leader_chat_turns", id)
                    .map_err(storage_failure)?
                    .clone();
                append_leader_reply(&mut u.records, &turn, response);
                rules::transition(&mut u.records, id, "completed", Value::Null)
                    .map_err(storage_failure)?;
                expire_approvals(&mut u.records, id);
                u.commit().await.map_err(storage_failure)?;
                events
                    .send(SessionEvent::Completed {
                        turn_id: provider_id.clone(),
                        text: response.clone(),
                    })
                    .await
                    .map_err(consumer_failure)?;
                *done = true;
            }
            IntegratedEvent::Cancelled => {
                let mut u = self.service.store.begin().await.map_err(storage_failure)?;
                rules::transition(&mut u.records, id, "cancelled", Value::Null)
                    .map_err(storage_failure)?;
                expire_approvals(&mut u.records, id);
                u.commit().await.map_err(storage_failure)?;
                return Err(SessionFailure::new(
                    "turn_cancelled",
                    "Integrated Conversation turn was cancelled",
                    false,
                ));
            }
            // Tool details are scoped to the worker; do not replace the leader's active tool list.
            IntegratedEvent::Tool { .. } => {}
        }
        Ok(())
    }
}

/// Reserve through the same persisted active-binding index as human chat turns.
/// Calling this pure rule requires the repository's serialized mutation transaction.
pub fn reserve(
    records: &mut Records,
    delivery_id: Uuid,
    target: &SessionDestination,
) -> Result<Record> {
    let delivery = records.get("session_deliveries", delivery_id)?.clone();
    if delivery.data["state"] != "dispatching" {
        return Err(Failure::new(
            "session_binding_conflict",
            "Delivery is not claimed",
        ));
    }
    let agent = delivery
        .reference("targetAgentId")
        .ok_or_else(Failure::missing)?;
    let binding = rules::binding(records, agent)?.clone();
    if binding.data["mode"] != "integrated" {
        return Err(Failure::new(
            "external_mode",
            "External sessions cannot be dispatched",
        ));
    }
    if delivery.reference("bindingId") != Some(binding.id)
        || binding.data["harness"] != target.harness
        || binding.data["installationId"] != target.installation_id
        || binding.data["externalId"] != target.external_id
        || binding.data["projectRoot"] != target.project_root
    {
        return Err(Failure::new(
            "session_binding_conflict",
            "Destination no longer matches active binding",
        ));
    }
    if records
        .list("leader_chat_turns")
        .iter()
        .any(|t| t.reference("sourceDeliveryId") == Some(delivery_id))
    {
        return Err(Failure::new(
            "session_binding_conflict",
            "Conversation delivery already has a turn; reconcile it instead of replaying",
        ));
    }
    if records.list("leader_chat_turns").iter().any(|t| {
        t.reference("bindingId") == Some(binding.id)
            && !terminal(t.data["status"].as_str().unwrap_or(""))
    }) {
        return Err(Failure::new(
            "session_busy",
            "An integrated turn already owns this binding",
        ));
    }
    let task = records.get(
        "tasks",
        delivery.reference("taskId").ok_or_else(Failure::missing)?,
    )?;
    let board = records.get(
        "boards",
        task.reference("boardId").ok_or_else(Failure::missing)?,
    )?;
    let team = records.get(
        "teams",
        board.reference("teamId").ok_or_else(Failure::missing)?,
    )?;
    let leader = team.reference("leaderId").ok_or_else(Failure::missing)?;
    let leader_binding = rules::binding(records, leader)
        .ok()
        .filter(|b| b.data["mode"] == "integrated")
        .map(|b| b.id);
    let chat = records
        .list("leader_chats")
        .into_iter()
        .find(|c| {
            c.reference("leaderAgentId") == Some(leader)
                && c.reference("bindingId") == leader_binding
                && leader_binding.is_some()
        })
        .cloned();
    let turn = Record::new(
        "leader_chat_turns",
        json!({"chatId":chat.as_ref().map(|c|c.id),"bindingId":binding.id,"ownerAgentId":agent,"sourceDeliveryId":delivery_id,"taskId":task.id,"status":"running","failure":null}),
    );
    records.insert(turn.clone());
    if agent == leader {
        if let Some(chat) = chat {
            let comment = records.get(
                "comments",
                delivery
                    .reference("commentId")
                    .ok_or_else(Failure::missing)?,
            )?;
            let sender = comment
                .reference("actorId")
                .and_then(|id| records.get("agents", id).ok())
                .and_then(|r| r.data["name"].as_str())
                .unwrap_or("Human");
            let content = format!(
                "Conversation notice from {sender}\n\n{}",
                comment.data["body"].as_str().unwrap_or("")
            );
            let message = Record::new(
                "leader_chat_messages",
                json!({"chatId":chat.id,"turnId":turn.id,"role":"system","content":content,"taskId":turn.data["taskId"],"clientMessageId":null}),
            );
            let value = rules::visible_message(&message);
            records.insert(message);
            rules::event(
                records,
                chat.id,
                turn.id,
                "message.updated",
                json!({"message":value}),
            );
        }
    }
    Ok(turn)
}
fn append_leader_reply(records: &mut Records, turn: &Record, text: &str) {
    let Some(chat) = turn
        .reference("chatId")
        .and_then(|id| records.get("leader_chats", id).ok())
        .cloned()
    else {
        return;
    };
    if chat.reference("leaderAgentId") != turn.reference("ownerAgentId") || text.is_empty() {
        return;
    }
    let msg = Record::new(
        "leader_chat_messages",
        json!({"chatId":chat.id,"turnId":turn.id,"role":"assistant","content":text,"taskId":turn.data["taskId"],"clientMessageId":null}),
    );
    let v = rules::visible_message(&msg);
    records.insert(msg);
    rules::event(
        records,
        chat.id,
        turn.id,
        "message.updated",
        json!({"message":v}),
    );
}
fn expire_approvals(records: &mut Records, turn_id: Uuid) {
    let ids: Vec<_> = records
        .list("leader_chat_approvals")
        .into_iter()
        .filter(|a| a.reference("turnId") == Some(turn_id) && a.data["status"] == "pending")
        .map(|a| a.id)
        .collect();
    for id in ids {
        if let Ok(row) = records.get_mut("leader_chat_approvals", id) {
            row.data["status"] = json!("expired");
            row.touch();
            let chat = row.reference("chatId");
            let v = rules::project(row);
            if let Some(chat) = chat {
                rules::event(
                    records,
                    chat,
                    turn_id,
                    "approval.updated",
                    json!({"approval":v}),
                );
            }
        }
    }
}
fn storage_failure(e: Failure) -> SessionFailure {
    SessionFailure::new("persistence_failed", e.error, true)
}
fn reservation_failure(e: Failure) -> SessionFailure {
    let code = match e.code.as_str() {
        "external_mode" => "external_mode",
        "session_busy" => "session_busy",
        "session_binding_conflict" => "session_binding_conflict",
        _ => "session_not_ready",
    };
    SessionFailure::new(code, e.error, false)
}
fn consumer_failure<T>(_: mpsc::error::SendError<T>) -> SessionFailure {
    SessionFailure::new(
        "consumer_closed",
        "Conversation delivery consumer closed",
        true,
    )
}
impl SessionProvider for WorkerDeliveryProvider {
    fn deliver<'a>(
        &'a self,
        _: &'a SessionDestination,
        _: &'a str,
        _: mpsc::Sender<SessionEvent>,
    ) -> Pin<Box<dyn Future<Output = std::result::Result<(), SessionFailure>> + Send + 'a>> {
        Box::pin(async {
            Err(SessionFailure::new(
                "invalid_request",
                "Integrated delivery requires structured delivery context",
                false,
            ))
        })
    }
    fn deliver_context<'a>(
        &'a self,
        destination: &'a SessionDestination,
        text: &'a str,
        events: mpsc::Sender<SessionEvent>,
        delivery_id: Uuid,
    ) -> Pin<Box<dyn Future<Output = std::result::Result<(), SessionFailure>> + Send + 'a>> {
        Box::pin(self.execute(destination, text, events, delivery_id))
    }
}
