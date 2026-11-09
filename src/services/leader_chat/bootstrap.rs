use super::*;
impl LeaderChatService {
    pub async fn create_session(&self, c: Command) -> Result<Value> {
        use crate::dto::leader_chat::CreateSession;
        let req: CreateSession =
            serde_json::from_value(c.body.clone()).map_err(|e| Failure::invalid(e.to_string()))?;
        let actor = c.actor()?;
        actor.validate()?;
        let key = c
            .idempotency_key
            .ok_or_else(|| Failure::invalid("Idempotency-Key required"))?;
        let agent = c.id("agentId")?;
        let op = format!("integrated:create-session:{agent}");
        let hash =
            serde_json::to_string(&json!({"body":c.body,"version":c.expected_version})).unwrap();
        let mut u = self.store.begin().await?;
        if !u.records.get("agents", agent)?.data["managedConfiguration"].is_null() {
            return Err(Failure::new(
                "operation_removed",
                "Use managed agent configuration and requests",
            ));
        }
        if let Some(actor_id) = actor.id {
            u.records.get("agents", actor_id)?;
        }
        if let Some(out) = u.replay(&actor.key(), &op, key, &hash).await? {
            u.rollback().await?;
            return Ok(out.data);
        }
        if let Some(old) = u
            .records
            .list("leader_session_operations")
            .into_iter()
            .find(|r| {
                r.data["operation"] == op
                    && r.data["actor"] == actor.key()
                    && r.data["requestKey"] == key.to_string()
            })
        {
            if old.data["hash"] != hash {
                return Err(Failure::new(
                    "idempotency_conflict",
                    "Request key already used",
                ));
            }
            if old.data["state"] == "failed" {
                return Err(Failure::new(
                    old.data["failure"]["code"]
                        .as_str()
                        .unwrap_or("session_not_ready"),
                    old.data["failure"]["message"]
                        .as_str()
                        .unwrap_or("Previous creation failed"),
                ));
            }
            return Err(Failure::new("session_creation_uncertain","Session creation outcome is pending reconciliation; retry will not create another thread"));
        }
        rules::ensure_agent_idle(&u.records, agent)?;
        let row = u.records.get("agents", agent)?;
        rules::check_version(row, c.expected_version)?;
        if row.archived_at.is_some() {
            return Err(Failure::new("session_not_ready", "Agent is archived"));
        }
        if rules::binding(&u.records, agent).ok().map(|b| b.id) != req.expected_binding_id {
            return Err(Failure::new(
                "session_binding_conflict",
                "Observe active binding before replacing it",
            ));
        }
        let provider = self
            .provider
            .as_ref()
            .ok_or_else(|| Failure::new("session_not_ready", "Codex runtime not configured"))?;
        provider
            .validate(&req.project_root, &req.tool_profile)
            .map_err(|e| Failure::new(e.code, e.message))?;
        // Durable reservation prevents duplicate provider threads across timeout/restart.
        let operation_id=u.records.insert(Record::new("leader_session_operations",json!({"operation":op,"actor":actor.key(),"requestKey":key,"hash":hash,"state":"pending"})));
        u.commit().await?;
        let external = match provider.create(&req.project_root, &req.tool_profile).await {
            Ok(external) => external,
            Err(error) => {
                let mut u = self.store.begin().await?;
                record_failure(
                    &mut u.records,
                    operation_id,
                    &error.code,
                    &error.message,
                    None,
                    error.uncertain,
                )?;
                u.commit().await?;
                return Err(Failure::new(
                    if error.uncertain {
                        "session_creation_uncertain"
                    } else {
                        error.code
                    },
                    error.message,
                ));
            }
        };
        let mut u = self.store.begin().await?;
        let activation = rules::ensure_agent_idle(&u.records, agent)
            .and_then(|_| rules::check_version(u.records.get("agents", agent)?, c.expected_version))
            .and_then(|_| {
                if rules::binding(&u.records, agent).ok().map(|b| b.id) != req.expected_binding_id {
                    Err(Failure::new(
                        "session_binding_conflict",
                        "Binding changed during creation; created thread left unbound",
                    ))
                } else {
                    Ok(())
                }
            });
        if let Err(error) = activation {
            record_failure(
                &mut u.records,
                operation_id,
                &error.code,
                &error.error,
                Some(&external),
                false,
            )?;
            u.commit().await?;
            return Err(error);
        }
        if let Some(id) = req.expected_binding_id {
            let old = u.records.get_mut("agent_session_bindings", id)?;
            old.data["endedAt"] = json!(chrono::Utc::now());
            old.data["endedBy"] = actor.value();
            old.touch();
        }
        let b = Record::new(
            "agent_session_bindings",
            json!({"agentId":agent,"mode":"integrated","toolProfile":req.tool_profile,"harness":"codex","installationId":self.installation,"externalId":external,"projectRoot":req.project_root,"startedAt":chrono::Utc::now(),"endedAt":null,"startedBy":actor.value(),"endedBy":null,"verification":"verified"}),
        );
        let data = json!({"agentId":agent,"bindingId":b.id,"mode":"integrated","harness":"codex","externalId":external,"projectRoot":req.project_root});
        u.records.insert(b);
        u.records.get_mut("agents", agent)?.touch();
        let operation = u
            .records
            .get_mut("leader_session_operations", operation_id)?;
        operation.data["state"] = json!("completed");
        operation.touch();
        u.save_replay(&actor.key(), &op, key, &hash, &Outcome::data(data.clone()))
            .await?;
        u.commit().await?;
        Ok(data)
    }
}

fn record_failure(
    records: &mut crate::repositories::records::Records,
    id: Uuid,
    code: &str,
    message: &str,
    external: Option<&str>,
    uncertain: bool,
) -> Result<()> {
    let operation = records.get_mut("leader_session_operations", id)?;
    operation.data["state"] = json!(if uncertain { "pending" } else { "failed" });
    operation.data["failure"] = json!({"code":code,"message":message});
    operation.data["externalId"] = json!(external);
    operation.touch();
    Ok(())
}
