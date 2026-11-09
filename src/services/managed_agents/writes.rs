use super::*;
impl ManagedAgentService {
    pub async fn write(&self, mut c: Command, origin: &str) -> Result<Value> {
        self.recover().await?;
        let key = c
            .idempotency_key
            .ok_or_else(|| Failure::new("version_required", "Idempotency-Key required"))?;
        // Canonicalize nullable references before comparing durable replay bodies.
        if c.operation == "managed:send" {
            let b: SendAgentRequest = serde_json::from_value(c.body.clone())
                .map_err(|e| Failure::invalid(e.to_string()))?;
            b.validate()?;
            c.body = serde_json::to_value(b).unwrap();
        }
        let op = format!(
            "{}:{}",
            c.operation,
            serde_json::to_string(&c.params).unwrap()
        );
        let hash =
            serde_json::to_string(&json!({"body":c.body,"version":c.expected_version})).unwrap();
        let mut u = self.store.begin().await?;
        if let Some(out) = u.replay("managed-local", &op, key, &hash).await? {
            u.rollback().await?;
            return Ok(out.data);
        }
        let mut control = None;
        let (data, agent) = match c.operation.as_str() {
            "managed:configure" => {
                let id = c.id("agentId")?;
                let a = u.records.get("agents", id)?;
                check_version(a, &c)?;
                let config: ExecutionConfiguration = serde_json::from_value(c.body.clone())
                    .map_err(|e| Failure::invalid(e.to_string()))?;
                config.validate()?;
                if a.archived_at.is_some() {
                    return Err(Failure::invalid("Agent is archived"));
                }
                if a.data["managedConfiguration"] != c.body {
                    if u.records
                        .list("managed_requests")
                        .iter()
                        .any(|r| r.reference("agentId") == Some(id) && !terminal(&r.data["state"]))
                    {
                        return Err(Failure::new("configuration_busy", "Agent has pending work"));
                    }
                    if u.records.list("session_deliveries").iter().any(|d| {
                        d.reference("targetAgentId") == Some(id)
                            && matches!(
                                d.data["state"].as_str(),
                                Some("pending" | "dispatching" | "acknowledged" | "uncertain")
                            )
                    }) {
                        return Err(Failure::new(
                            "configuration_busy",
                            "Legacy deliveries must drain before configuration",
                        ));
                    }
                    // Old owned work must drain before the new generation can take over.
                    if u.records.list("leader_chat_turns").iter().any(|r| {
                        !crate::dto::leader_chat::terminal(r.data["status"].as_str().unwrap_or(""))
                            && u.records
                                .get(
                                    "agent_session_bindings",
                                    r.reference("bindingId").unwrap_or_default(),
                                )
                                .is_ok_and(|b| b.reference("agentId") == Some(id))
                    }) {
                        return Err(Failure::new(
                            "configuration_busy",
                            "Legacy work must finish or be reconciled first",
                        ));
                    }
                    let provider = self.provider
                        .as_ref()
                        .ok_or_else(|| {
                            Failure::new(
                                "provider_unavailable",
                                "Configure the local Codex runtime first",
                            )
                        })?;
                    let project_root = provider.default_workspace(id)
                        .map_err(|e| Failure::new(e.code, e.message))?;
                    provider.validate(
                            &project_root,
                            &serde_json::to_value(config.tool_profile).unwrap(),
                        )
                        .map_err(|e| Failure::new(e.code, e.message))?;
                    let a = u.records.get_mut("agents", id)?;
                    a.data["managedConfiguration"] = c.body.clone();
                    a.touch();
                    a.data["managedGeneration"] = json!(a.version);
                    a.data["managedInstallation"] = json!(self.installation);
                    let ids: Vec<_> = u
                        .records
                        .list("managed_conversations")
                        .iter()
                        .filter(|r| r.reference("agentId") == Some(id))
                        .map(|r| r.id)
                        .collect();
                    for cid in ids {
                        let row = u.records.get_mut("managed_conversations", cid)?;
                        row.data["readOnly"] = json!(true);
                        row.touch();
                    }
                }
                (configuration(&u.records, id)?, id)
            }
            "managed:send" => {
                let id = c.id("agentId")?;
                let a = u.records.get("agents", id)?.clone();
                if a.archived_at.is_some() || a.data["managedConfiguration"].is_null() {
                    return Err(Failure::new(
                        "invalid_request",
                        "Configure an active agent before sending",
                    ));
                }
                if u.records
                    .list("managed_requests")
                    .iter()
                    .filter(|r| r.reference("agentId") == Some(id) && !terminal(&r.data["state"]))
                    .count()
                    >= 32
                {
                    return Err(Failure::new("queue_full", "Agent queue is full"));
                }
                let b: SendAgentRequest = serde_json::from_value(c.body.clone()).unwrap();
                if let Some(t) = b.task_id {
                    let task = u.records.get("tasks", t)?;
                    if task.archived_at.is_some() {
                        return Err(Failure::invalid("Task archived"));
                    }
                }
                let generation = a.data["managedGeneration"].clone();
                let conversation = if let Some(cid) = b.conversation_id {
                    let row = u.records.get("managed_conversations", cid)?;
                    if row.reference("agentId") != Some(id)
                        || b.task_id
                            .is_some_and(|t| row.reference("taskId") != Some(t))
                    {
                        return Err(Failure::new(
                            "conversation_mismatch",
                            "Conversation belongs to another context",
                        ));
                    }
                    if row.data["configurationVersion"] != generation
                        || row.data["readOnly"] == true
                    {
                        return Err(Failure::new(
                            "configuration_changed",
                            "Start a new conversation after configuration changes",
                        ));
                    }
                    if row.data["installationId"] != self.installation {
                        return Err(Failure::new("provider_unavailable","Continue this conversation on its original installation, or start a new conversation here"));
                    }
                    row.clone()
                } else {
                    let row = Record::new(
                        "managed_conversations",
                        json!({"agentId":id,"configurationVersion":generation,"taskId":b.task_id,"title":b.content.chars().take(60).collect::<String>(),"readOnly":false,"providerThread":null,"installationId":self.installation}),
                    );
                    u.records.insert(row.clone());
                    row
                };
                validate_context(&u.records, id, conversation.reference("taskId"))?;
                let row = Record::new(
                    "managed_requests",
                    json!({"agentId":id,"conversationId":conversation.id,"taskId":conversation.data["taskId"],"configurationVersion":generation,"state":"queued","origin":{"transport":origin,"label":null},"error":null,"content":b.content,"providerTurn":null}),
                );
                u.records.insert(Record::new("managed_messages",json!({"conversationId":conversation.id,"requestId":row.id,"role":"requester","content":b.content})));
                u.records.insert(row.clone());
                event(&mut u.records, row.id)?;
                (public(&row), id)
            }
            "managed:cancel" => {
                let id = c.id("requestId")?;
                let r = u.records.get("managed_requests", id)?.clone();
                check_version(&r, &c)?;
                if r.data["state"] == "queued" {
                    transition(&mut u.records, id, "cancelled", Value::Null)?;
                } else if !terminal(&r.data["state"]) {
                    let row = u.records.get_mut("managed_requests", id)?;
                    row.data["cancelRequested"] = json!(true);
                    row.touch();
                    event(&mut u.records, id)?;
                    control = Some((id, Control::Cancel));
                }
                (
                    public(u.records.get("managed_requests", id)?),
                    r.reference("agentId").unwrap(),
                )
            }
            "managed:decision" => {
                let id = c.id("approvalId")?;
                let r = u.records.get("managed_approvals", id)?.clone();
                check_version(&r, &c)?;
                if r.data["state"] != "pending" {
                    return Err(Failure::new(
                        "approval_expired",
                        "Approval is no longer pending",
                    ));
                }
                if c.body.as_object().is_none_or(|o| o.len() != 1)
                    || !matches!(c.body["decision"].as_str(), Some("accept" | "decline"))
                {
                    return Err(Failure::invalid("Choose accept or decline"));
                }
                let rid = r.reference("requestId").unwrap();
                if !self
                    .controls
                    .lock()
                    .await
                    .get(&rid)
                    .is_some_and(|tx| !tx.is_closed())
                {
                    return Err(Failure::new(
                        "outcome_unknown",
                        "Original provider operation is no longer connected",
                    ));
                }
                let a = u.records.get_mut("managed_approvals", id)?;
                a.data["state"] = json!(if c.body["decision"] == "accept" {
                    "accepted"
                } else {
                    "declined"
                });
                a.touch();
                let result = public(a);
                if c.body["decision"] == "decline" {
                    u.records.get_mut("managed_requests", rid)?.data["declined"] = json!(true);
                }
                transition(&mut u.records, rid, "running", Value::Null)?;
                control = Some((
                    rid,
                    Control::Decision {
                        approval_id: id,
                        accept: c.body["decision"] == "accept",
                    },
                ));
                (result, r.reference("agentId").unwrap())
            }
            _ => return Err(Failure::invalid("Unknown managed mutation")),
        };
        u.save_replay(
            "managed-local",
            &op,
            key,
            &hash,
            &Outcome::data(data.clone()),
        )
        .await?;
        u.commit().await?;
        if let Some((id, control)) = control {
            if let Some(tx) = self.controls.lock().await.get(&id).cloned() {
                let _ = tx.send(control).await;
            }
        }
        self.schedule(agent);
        Ok(data)
    }
}
