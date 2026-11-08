use super::*;
use crate::{
    dto::{leader_chat::terminal, session_delivery::SessionDestination},
    repositories::{integrated_provider::IntegratedEvent, records::Record},
};
impl LeaderChatService {
    pub(crate) async fn execute_turn(&self, id: Uuid) -> Result<()> {
        let result = self.run_turn(id).await;
        self.controls.lock().await.remove(&id);
        if result.is_err() {
            if let Ok(mut u) = self.store.begin().await {
                if u.records
                    .get("leader_chat_turns", id)
                    .is_ok_and(|r| !terminal(r.data["status"].as_str().unwrap_or("")))
                {
                    let _ = rules::transition(
                        &mut u.records,
                        id,
                        "uncertain",
                        json!({"code":"persistence_failure","message":"Provider execution requires reconciliation"}),
                    );
                    let _ = u.commit().await;
                }
            }
        }
        result
    }
    async fn run_turn(&self, id: Uuid) -> Result<()> {
        let provider = self
            .provider
            .as_ref()
            .ok_or_else(|| Failure::new("session_not_ready", "Provider unavailable"))?
            .clone();
        let mut u = self.store.begin().await?;
        let turn = u.records.get("leader_chat_turns", id)?.clone();
        if turn.data["status"] != "queued" {
            u.rollback().await?;
            return Ok(());
        }
        let chat = u
            .records
            .get(
                "leader_chats",
                turn.reference("chatId").ok_or_else(Failure::missing)?,
            )?
            .clone();
        let b = match rules::active_binding(&u.records, &chat) {
            Ok(b) => b,
            Err(e) => {
                rules::transition(
                    &mut u.records,
                    id,
                    "failed",
                    json!({"code":e.code,"message":e.error}),
                )?;
                return u.commit().await;
            }
        };
        if b.data["installationId"] != self.installation {
            rules::transition(
                &mut u.records,
                id,
                "failed",
                json!({"code":"session_not_ready","message":"Session belongs to another Bee Team installation"}),
            )?;
            return u.commit().await;
        }
        let target: SessionDestination =
            serde_json::from_value(b.data.clone()).map_err(|e| Failure::invalid(e.to_string()))?;
        let message = u
            .records
            .list("leader_chat_messages")
            .into_iter()
            .find(|m| m.reference("turnId") == Some(id) && m.data["role"] == "user")
            .ok_or_else(Failure::missing)?;
        let text = super::context::prompt(&chat, &b, message);
        rules::transition(&mut u.records, id, "running", Value::Null)?;
        let (control_tx, control_rx) = mpsc::channel(16);
        self.controls.lock().await.insert(id, control_tx);
        if let Err(error) = u.commit().await {
            self.controls.lock().await.remove(&id);
            return Err(error);
        }
        let (tx, mut rx) = mpsc::channel(32);
        let work = provider.run(&target, &text, &b.data["toolProfile"], tx, control_rx);
        tokio::pin!(work);
        let mut got_terminal = false;
        let mut receiving = true;
        loop {
            tokio::select! {
              event=rx.recv(),if receiving=>{if let Some(e)=event{got_terminal|=matches!(e,IntegratedEvent::Completed|IntegratedEvent::Cancelled);self.persist_event(id,e).await?;}else{receiving=false;}}
              result=&mut work=>{
                while let Ok(e)=rx.try_recv(){got_terminal|=matches!(e,IntegratedEvent::Completed|IntegratedEvent::Cancelled);self.persist_event(id,e).await?;}
                if let Err(e)=result {let mut u=self.store.begin().await?;rules::transition(&mut u.records,id,if e.uncertain{"uncertain"}else{"failed"},json!({"code":e.code,"message":e.message}))?;u.commit().await?;}
                else if !got_terminal{let mut u=self.store.begin().await?;rules::transition(&mut u.records,id,"uncertain",json!({"code":"missing_completion","message":"Provider ended without final event"}))?;u.commit().await?;}
                break;
              }
            }
        }
        self.controls.lock().await.remove(&id);
        Ok(())
    }
    pub(super) async fn persist_event(&self, id: Uuid, e: IntegratedEvent) -> Result<()> {
        let mut u = self.store.begin().await?;
        let turn = u.records.get("leader_chat_turns", id)?.clone();
        let chat = turn.reference("chatId").ok_or_else(Failure::missing)?;
        let task = u
            .records
            .list("leader_chat_messages")
            .into_iter()
            .find(|m| m.reference("turnId") == Some(id) && m.data["role"] == "user")
            .and_then(|m| m.reference("taskId"));
        if terminal(turn.data["status"].as_str().unwrap_or("")) {
            return u.rollback().await;
        }
        match e {
            IntegratedEvent::Accepted(provider_id) => {
                let row = u.records.get_mut("leader_chat_turns", id)?;
                row.data["providerTurnId"] = json!(provider_id);
            }
            IntegratedEvent::Text(text) => {
                if turn.data["status"] == "waiting_approval"
                    && !u
                        .records
                        .list("leader_chat_approvals")
                        .iter()
                        .any(|a| a.reference("turnId") == Some(id) && a.data["status"] == "pending")
                {
                    rules::transition(&mut u.records, id, "running", Value::Null)?;
                }
                let existing = u
                    .records
                    .list("leader_chat_messages")
                    .into_iter()
                    .find(|r| r.reference("turnId") == Some(id) && r.data["role"] == "assistant")
                    .map(|r| r.id);
                let mid = if let Some(mid) = existing {
                    let row = u.records.get_mut("leader_chat_messages", mid)?;
                    row.data["content"] = json!(text);
                    row.touch();
                    mid
                } else {
                    u.records.insert(Record::new("leader_chat_messages",json!({"chatId":chat,"turnId":id,"role":"assistant","content":text,"taskId":task,"clientMessageId":null})))
                };
                let v = rules::visible_message(u.records.get("leader_chat_messages", mid)?);
                rules::event(
                    &mut u.records,
                    chat,
                    id,
                    "message.updated",
                    json!({"message":v}),
                );
            }
            IntegratedEvent::Completed | IntegratedEvent::Cancelled => {
                let state = if matches!(e, IntegratedEvent::Completed) {
                    "completed"
                } else {
                    "cancelled"
                };
                rules::transition(&mut u.records, id, state, Value::Null)?;
                let aids: Vec<_> = u
                    .records
                    .list("leader_chat_approvals")
                    .into_iter()
                    .filter(|r| r.reference("turnId") == Some(id) && r.data["status"] == "pending")
                    .map(|r| r.id)
                    .collect();
                for aid in aids {
                    let a = u.records.get_mut("leader_chat_approvals", aid)?;
                    a.data["status"] = json!("expired");
                    a.touch();
                    let v = rules::project(a);
                    rules::event(
                        &mut u.records,
                        chat,
                        id,
                        "approval.updated",
                        json!({"approval":v}),
                    );
                }
            }
            IntegratedEvent::Approval {
                approval_id,
                kind,
                title,
                description,
                command,
                host,
                paths,
            } => {
                let agent = turn.reference("ownerAgentId").or(u
                    .records
                    .get("leader_chats", chat)?
                    .reference("leaderAgentId"));
                let mut a = Record::new(
                    "leader_chat_approvals",
                    json!({"chatId":chat,"turnId":id,"bindingId":turn.data["bindingId"],"agentId":agent,"taskId":task,"kind":kind,"title":title,"description":description,"command":command,"host":host,"paths":paths,"status":"pending","expiresAt":chrono::Utc::now()+chrono::Duration::minutes(15)}),
                );
                a.id = approval_id;
                let v = rules::project(&a);
                u.records.insert(a);
                rules::transition(&mut u.records, id, "waiting_approval", Value::Null)?;
                rules::event(
                    &mut u.records,
                    chat,
                    id,
                    "approval.updated",
                    json!({"approval":v}),
                );
            }
            IntegratedEvent::Tool { name, summary } => {
                let row = Record::new(
                    "leader_chat_tools",
                    json!({"chatId":chat,"turnId":id,"name":name,"status":"completed","summary":summary.chars().take(1024).collect::<String>()}),
                );
                let mut tool = row.data.clone();
                tool["id"] = json!(row.id);
                tool["revision"] = json!(1);
                tool.as_object_mut().unwrap().remove("chatId");
                u.records.insert(row);
                rules::event(
                    &mut u.records,
                    chat,
                    id,
                    "tool.updated",
                    json!({"tool":tool}),
                );
            }
        }
        u.commit().await
    }
}
