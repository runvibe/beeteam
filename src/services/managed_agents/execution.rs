use super::*;
use crate::{
    dto::session_delivery::SessionDestination,
    repositories::integrated_provider::{IntegratedEvent, ReconciledStatus},
};

impl ManagedAgentService {
    pub(super) async fn drain(&self, agent: Uuid) -> Result<()> {
        loop {
            let mut u = self.store.begin().await?;
            let pending: Vec<_> = u
                .records
                .list("managed_requests")
                .into_iter()
                .filter(|r| r.reference("agentId") == Some(agent) && !terminal(&r.data["state"]))
                .cloned()
                .collect();
            if pending.iter().any(|r| r.data["state"] != "queued") {
                u.rollback().await?;
                return Ok(());
            }
            let Some(request) = pending.into_iter().min_by_key(|r| r.id) else {
                u.rollback().await?;
                return Ok(());
            };
            let conversation = u.records.get(
                "managed_conversations",
                request.reference("conversationId").unwrap(),
            )?;
            if conversation.data["installationId"] != self.installation {
                u.rollback().await?;
                return Ok(());
            }
            transition(&mut u.records, request.id, "preparing", Value::Null)?;
            u.commit().await?;
            if let Err(e) = self.execute(request.id).await {
                self.controls.lock().await.remove(&request.id);
                self.fail(request.id, true, "outcome_unknown").await?;
                tracing::warn!(code=%e.code,"Managed execution requires recovery");
                return Ok(());
            }
        }
    }
    async fn execute(&self, id: Uuid) -> Result<()> {
        let u = self.store.begin().await?;
        let request = u.records.get("managed_requests", id)?.clone();
        let agent = request.reference("agentId").unwrap();
        let a = u.records.get("agents", agent)?.clone();
        if validate_context(&u.records, agent, request.reference("taskId")).is_err() {
            u.rollback().await?;
            return self.fail(id, false, "execution_failed").await;
        }
        let cid = request.reference("conversationId").unwrap();
        let conversation = u.records.get("managed_conversations", cid)?.clone();
        let config = a.data["managedConfiguration"].clone();
        u.rollback().await?;
        let Some(provider) = self.provider.clone() else {
            return self.fail(id, false, "provider_unavailable").await;
        };
        if conversation.data["installationId"] != self.installation {
            return self.fail(id, false, "provider_unavailable").await;
        }
        let thread = if let Some(t) = conversation.data["providerThread"].as_str() {
            t.to_owned()
        } else {
            match provider
                .create(
                    config["projectRoot"].as_str().unwrap(),
                    &config["toolProfile"],
                )
                .await
            {
                Ok(t) => {
                    let mut u = self.store.begin().await?;
                    let c = u.records.get_mut("managed_conversations", cid)?;
                    c.data["providerThread"] = json!(t);
                    c.touch();
                    u.commit().await?;
                    t
                }
                Err(e) => return self.fail(id, e.uncertain, e.code).await,
            }
        };
        let target = SessionDestination {
            harness: "codex".into(),
            installation_id: self.installation.clone(),
            external_id: thread,
            project_root: config["projectRoot"].as_str().unwrap().into(),
        };
        let (tx, mut rx) = mpsc::channel(32);
        let (control_tx, control_rx) = mpsc::channel(16);
        self.controls.lock().await.insert(id, control_tx);
        let mut u = self.store.begin().await?;
        if u.records.get("managed_requests", id)?.data["cancelRequested"] == true {
            transition(&mut u.records, id, "cancelled", Value::Null)?;
            u.commit().await?;
            self.controls.lock().await.remove(&id);
            return Ok(());
        }
        transition(&mut u.records, id, "running", Value::Null)?;
        u.commit().await?;
        let text=format!("Bee Team persisted execution context (not user-authored):\nAgent: {agent}; conversation: {cid}; task: {}. You are this Bee Team-managed agent. Do not claim, bind or replace sessions. Communicate with other agents only through the task Conversation. Record worker summaries using the assigned task.\nUser message:\n{}",request.data["taskId"],request.data["content"].as_str().unwrap());
        let work = provider.run(&target, &text, &config["toolProfile"], tx, control_rx);
        tokio::pin!(work);
        let result = loop {
            tokio::select! {
                Some(e)=rx.recv()=>self.persist(id,e).await?,
                result=&mut work=>{while let Ok(e)=rx.try_recv(){self.persist(id,e).await?;}break result;}
            }
        };
        self.controls.lock().await.remove(&id);
        match result {
            Err(e) => self.fail(id, e.uncertain, e.code).await,
            Ok(()) => {
                let u = self.store.begin().await?;
                let done = terminal(&u.records.get("managed_requests", id)?.data["state"]);
                u.rollback().await?;
                if !done {
                    self.fail(id, true, "outcome_unknown").await?;
                }
                Ok(())
            }
        }
    }
    async fn fail(&self, id: Uuid, uncertain: bool, code: &str) -> Result<()> {
        let mut u = self.store.begin().await?;
        transition(
            &mut u.records,
            id,
            if uncertain { "uncertain" } else { "failed" },
            json!({"code":if uncertain{"outcome_unknown"}else if code=="needs_auth"{"needs_auth"}else{"execution_failed"},"message":if code=="needs_auth"{"Sign in to Codex locally before sending a new request"}else{"Provider execution could not complete"},"retryable":false}),
        )?;
        u.commit().await
    }
    async fn persist(&self, id: Uuid, e: IntegratedEvent) -> Result<()> {
        let mut u = self.store.begin().await?;
        let r = u.records.get("managed_requests", id)?.clone();
        if terminal(&r.data["state"]) {
            return u.rollback().await;
        }
        match e {
            IntegratedEvent::Accepted(turn) => {
                u.records.get_mut("managed_requests", id)?.data["providerTurn"] = json!(turn)
            }
            IntegratedEvent::Text(text) => save_text(&mut u.records, &r, text)?,
            IntegratedEvent::Approval {
                approval_id,
                kind,
                description,
                command,
                host,
                paths,
                ..
            } => {
                let description = format!(
                    "{description}\nCommand: {}\nHost: {}\nPaths: {}",
                    command.as_deref().unwrap_or("-"),
                    host.as_deref().unwrap_or("-"),
                    paths.join(", ")
                );
                if description.len() > 8192 {
                    return Err(Failure::new(
                        "payload_too_large",
                        "Approval details exceed limit",
                    ));
                }
                let mut a = Record::new(
                    "managed_approvals",
                    json!({"requestId":id,"agentId":r.data["agentId"],"kind":kind,"description":description,"state":"pending","expiresAt":null}),
                );
                a.id = approval_id;
                u.records.insert(a);
                u.records.get_mut("managed_requests", id)?.data["state"] =
                    json!("awaiting_approval");
            }
            IntegratedEvent::Completed | IntegratedEvent::Cancelled => {
                let state = if r.data["declined"] == true {
                    "failed"
                } else if matches!(e, IntegratedEvent::Completed) {
                    "completed"
                } else {
                    "cancelled"
                };
                transition(&mut u.records, id, state, decline_error(&r))?;
                let ids: Vec<_> = u
                    .records
                    .list("managed_approvals")
                    .iter()
                    .filter(|a| {
                        a.reference("requestId") == Some(id) && a.data["state"] == "pending"
                    })
                    .map(|a| a.id)
                    .collect();
                for aid in ids {
                    let a = u.records.get_mut("managed_approvals", aid)?;
                    a.data["state"] = json!("expired");
                    a.touch();
                }
            }
            IntegratedEvent::Tool { .. } => {}
        }
        u.records.get_mut("managed_requests", id)?.touch();
        event(&mut u.records, id)?;
        super::conversation::complete(&mut u.records, id)?;
        u.commit().await
    }
    pub async fn reconcile(&self, c: Command) -> Result<Value> {
        self.recover().await?;
        let id = c.id("requestId")?;
        let key = c
            .idempotency_key
            .ok_or_else(|| Failure::new("version_required", "Idempotency-Key required"))?;
        let op = format!("managed:reconcile:{id}");
        let hash = serde_json::to_string(&json!({"version":c.expected_version})).unwrap();
        let mut u = self.store.begin().await?;
        if let Some(out) = u.replay("managed-local", &op, key, &hash).await? {
            u.rollback().await?;
            return Ok(out.data);
        }
        let r = u.records.get("managed_requests", id)?.clone();
        check_version(&r, &c)?;
        if r.data["state"] != "uncertain" {
            return Err(Failure::invalid(
                "Only uncertain requests require reconciliation",
            ));
        }
        let conversation = u
            .records
            .get(
                "managed_conversations",
                r.reference("conversationId").unwrap(),
            )?
            .clone();
        let agent = r.reference("agentId").unwrap();
        let config = u.records.get("agents", agent)?.data["managedConfiguration"].clone();
        let (Some(thread), Some(turn)) = (
            conversation.data["providerThread"].as_str(),
            r.data["providerTurn"].as_str(),
        ) else {
            let out = public(&r);
            u.save_replay(
                "managed-local",
                &op,
                key,
                &hash,
                &Outcome::data(out.clone()),
            )
            .await?;
            u.commit().await?;
            return Ok(out);
        };
        u.rollback().await?;
        if conversation.data["installationId"] != self.installation {
            return Err(Failure::new(
                "provider_unavailable",
                "Original installation required",
            ));
        }
        let target = SessionDestination {
            harness: "codex".into(),
            installation_id: self.installation.clone(),
            external_id: thread.into(),
            project_root: config["projectRoot"].as_str().unwrap().into(),
        };
        let result = self
            .provider
            .as_ref()
            .ok_or_else(|| Failure::new("provider_unavailable", "Provider unavailable"))?
            .reconcile(&target, turn, &config["toolProfile"])
            .await
            .map_err(|e| Failure::new(e.code, "Could not inspect original turn"))?;
        let mut u = self.store.begin().await?;
        if let Some(out) = u.replay("managed-local", &op, key, &hash).await? {
            u.rollback().await?;
            return Ok(out.data);
        }
        check_version(u.records.get("managed_requests", id)?, &c)?;
        let state = match result.status {
            ReconciledStatus::Completed if r.data["declined"] == true => "failed",
            ReconciledStatus::Completed => "completed",
            ReconciledStatus::Cancelled => "cancelled",
            ReconciledStatus::Failed => "failed",
            _ => "uncertain",
        };
        if let Some(text) = result.text {
            save_text(&mut u.records, &r, text)?;
        }
        transition(&mut u.records, id, state, decline_error(&r))?;
        let out = public(u.records.get("managed_requests", id)?);
        u.save_replay(
            "managed-local",
            &op,
            key,
            &hash,
            &Outcome::data(out.clone()),
        )
        .await?;
        u.commit().await?;
        self.schedule(agent);
        Ok(out)
    }
}
fn decline_error(r: &Record) -> Value {
    if r.data["declined"] == true {
        json!({"code":"execution_failed","message":"The requested action was declined","retryable":false})
    } else {
        Value::Null
    }
}
fn save_text(records: &mut Records, request: &Record, text: String) -> Result<()> {
    let text = bounded_text(text);
    let id = request.id;
    let existing = records
        .list("managed_messages")
        .iter()
        .find(|m| m.reference("requestId") == Some(id) && m.data["role"] == "agent")
        .map(|m| m.id);
    if let Some(mid) = existing {
        let m = records.get_mut("managed_messages", mid)?;
        m.data["content"] = json!(text);
        m.touch();
    } else {
        records.insert(Record::new("managed_messages",json!({"conversationId":request.data["conversationId"],"requestId":id,"role":"agent","content":text})));
    }
    Ok(())
}
fn bounded_text(mut text: String) -> String {
    const NOTICE: &str = "\n[Response shortened to the 65536-byte display limit.]";
    if text.len() > 65536 {
        let mut end = 65536 - NOTICE.len();
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
        text.push_str(NOTICE);
    }
    text
}
#[cfg(test)]
mod output_tests {
    use super::*;
    #[test]
    fn unicode_output_is_bounded() {
        let text = bounded_text("\u{1f41d}".repeat(20000));
        assert!(text.len() <= 65536);
        assert!(text.ends_with("display limit.]"));
    }
}
