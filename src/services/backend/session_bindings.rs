//! Declared session ownership, independent from provider delivery/capabilities.
use super::*;
use crate::dto::session_bindings::Session;

pub(super) fn close_for_archive(unit: &mut UnitOfWork, c: &Command, id: Uuid) -> Result<()> {
    crate::services::leader_chat::rules::ensure_agent_idle(&unit.records, id)?;
    let actor = c.actor()?.value();
    let now = Utc::now();
    for binding in unit.records.rows.values_mut().filter(|b| {
        b.table == "agent_session_bindings"
            && b.deleted_at.is_none()
            && b.reference("agentId") == Some(id)
            && b.data["endedAt"].is_null()
    }) {
        binding.data["endedAt"] = json!(now);
        binding.data["endedBy"] = actor.clone();
        binding.touch();
    }
    Ok(())
}

pub(super) async fn run(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let session: Session = serde_json::from_value(c.body["session"].clone())
        .map_err(|e| Failure::invalid(e.to_string()))?;
    session.validate()?;
    let agent_id = if c.operation == "createAgentWithSession" {
        let mut create = c.clone();
        create.operation = "createAgent".into();
        create.body = c.body["agent"].clone();
        Box::pin(ra::run(unit, &create))
            .await?
            .created_id
            .ok_or_else(Failure::missing)?
    } else {
        c.id("agentId")?
    };
    let agent = active(&unit.records, "agents", agent_id)?.clone();
    crate::services::leader_chat::rules::ensure_agent_idle(&unit.records, agent_id)?;
    if c.operation != "createAgentWithSession" {
        check_version(&agent, c.expected_version)?;
    }
    let current = unit
        .records
        .list("agent_session_bindings")
        .into_iter()
        .find(|b| b.reference("agentId") == Some(agent_id) && b.data["endedAt"].is_null())
        .cloned();
    let expected = c
        .body
        .get("expectedBindingId")
        .filter(|v| !v.is_null())
        .map(value_id)
        .transpose()?;
    if current.as_ref().map(|b| b.id) != expected {
        return Err(Failure::new(
            "session_binding_conflict",
            "Explicit replacement requires the observed active binding ID",
        ));
    }
    if unit.records.list("agent_session_bindings").iter().any(|b| {
        b.data["endedAt"].is_null()
            && b.reference("agentId") != Some(agent_id)
            && b.data["harness"] == session.harness
            && b.data["installationId"] == session.installation_id
            && b.data["externalId"] == session.external_id
    }) {
        return Err(Failure::new(
            "session_binding_conflict",
            "Session is already bound to another agent",
        ));
    }
    let now = Utc::now();
    if let Some(previous) = current {
        let old = unit
            .records
            .get_mut("agent_session_bindings", previous.id)?;
        old.data["endedAt"] = json!(now);
        old.data["endedBy"] = c.actor()?.value();
        old.touch();
    }
    let mut data = serde_json::to_value(session).map_err(|e| Failure::invalid(e.to_string()))?;
    data["agentId"] = json!(agent_id);
    data["startedAt"] = json!(now);
    data["endedAt"] = Value::Null;
    data["startedBy"] = c.actor()?.value();
    data["endedBy"] = Value::Null;
    data["verification"] = json!("declared");
    let binding_id = unit
        .records
        .insert(Record::new("agent_session_bindings", data));
    unit.records.get_mut("agents", agent_id)?.touch();
    let mut result = Outcome::data(
        json!({"agent":queries::resource(&unit.records,"agents",agent_id)?,
        "sessionBinding":unit.records.get("agent_session_bindings",binding_id)?.value()}),
    );
    result.version = Some(unit.records.get("agents", agent_id)?.version);
    if c.operation == "createAgentWithSession" {
        result.created_id = Some(agent_id);
    }
    Ok(result)
}
