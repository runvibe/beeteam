//! Transactional intent creation shared by HTTP and compound MCP writes.
use crate::{
    dto::backend::{Failure, Result},
    repositories::records::{Record, Records},
};
use serde_json::{json, Value};
use uuid::Uuid;

fn team(records: &Records, task: Uuid) -> Result<(Uuid, Uuid)> {
    let board = records
        .get("tasks", task)?
        .reference("boardId")
        .ok_or_else(Failure::missing)?;
    let team = records
        .get("boards", board)?
        .reference("teamId")
        .ok_or_else(Failure::missing)?;
    let leader = records
        .get("teams", team)?
        .reference("leaderId")
        .ok_or_else(Failure::missing)?;
    Ok((team, leader))
}
pub(crate) fn member(records: &Records, task: Uuid, agent: Uuid) -> Result<()> {
    let (team, leader) = team(records, task)?;
    let profile = records.get("agents", agent)?;
    if profile.archived_at.is_some()
        || (agent != leader
            && !records.list("memberships").iter().any(|m| {
                m.reference("teamId") == Some(team)
                    && m.reference("agentId") == Some(agent)
                    && m.archived_at.is_none()
            }))
    {
        return Err(Failure::invalid(
            "Mention recipient must be an active member of the task's team",
        ));
    }
    Ok(())
}
pub fn active_binding(records: &Records, agent: Uuid) -> Option<&Record> {
    records
        .list("agent_session_bindings")
        .into_iter()
        .find(|b| b.reference("agentId") == Some(agent) && b.data["endedAt"].is_null())
}
pub(crate) fn task_active(records: &Records, id: Uuid) -> bool {
    let mut current = Some(id);
    let mut seen = std::collections::BTreeSet::new();
    while let Some(id) = current {
        if !seen.insert(id) {
            return false;
        }
        let Ok(task) = records.get("tasks", id) else {
            return false;
        };
        if task.archived_at.is_some() {
            return false;
        }
        let Some(board) = task
            .reference("boardId")
            .and_then(|id| records.get("boards", id).ok())
        else {
            return false;
        };
        if board.archived_at.is_some() {
            return false;
        }
        let Some(team) = board
            .reference("teamId")
            .and_then(|id| records.get("teams", id).ok())
        else {
            return false;
        };
        if team.archived_at.is_some() {
            return false;
        }
        current = task.reference("parentId");
    }
    true
}
pub fn enqueue(
    records: &mut Records,
    task: Uuid,
    comment: Uuid,
    target: Uuid,
    kind: &str,
    source: Uuid,
    expects_reply: bool,
) -> Result<()> {
    if records.list("session_deliveries").iter().any(|r| {
        r.reference("sourceId") == Some(source)
            && r.reference("targetAgentId") == Some(target)
            && r.data["kind"] == kind
    }) {
        return Ok(());
    }
    if crate::services::managed_agents::conversation::enqueue(
        records,
        task,
        comment,
        target,
        kind,
        source,
        expects_reply,
    )? {
        return Ok(());
    }
    let message = records.get("comments", comment)?.clone();
    let origin = message
        .reference("actorId")
        .and_then(|a| active_binding(records, a))
        .map(|b| b.id);
    let binding = active_binding(records, target).cloned();
    let destination = binding.as_ref().map(|b| json!({"harness":b.data["harness"],"installationId":b.data["installationId"],"externalId":b.data["externalId"],"projectRoot":b.data["projectRoot"]}));
    let state = match binding.as_ref() {
        Some(b) if b.data["mode"] == "integrated" => "pending",
        Some(_) => "waiting_external",
        None => "waiting_binding",
    };
    records.insert(Record::new("session_deliveries", json!({"taskId":task,"commentId":comment,"sourceId":source,"kind":kind,"targetAgentId":target,"requesterAgentId":message.data["actorId"],"originBindingId":origin,"bindingId":binding.as_ref().map(|b|b.id),"destination":destination,"state":state,"turnId":null,"errorCode":null,"expectsReply":expects_reply,"replyCommentId":null})));
    Ok(())
}
pub fn comment(
    records: &mut Records,
    task: Uuid,
    comment: Uuid,
    recipients: &[Uuid],
) -> Result<()> {
    for recipient in recipients {
        member(records, task, *recipient)?;
    }
    for recipient in recipients {
        enqueue(records, task, comment, *recipient, "mention", comment, true)?;
    }
    Ok(())
}
pub fn summary(records: &mut Records, task: Uuid, summary: Uuid) -> Result<()> {
    let record = records.get("execution_summaries", summary)?.clone();
    let Some(author) = record.reference("actorId") else {
        return Ok(());
    };
    if record.data["actorKind"] != "agent" {
        return Ok(());
    }
    // An explicit author binding selects managed workflow. Legacy skills-only
    // workers retain their existing notification behavior and create no backlog.
    if active_binding(records, author).is_none()
        && records.get("agents", author)?.data["managedConfiguration"].is_null()
    {
        return Ok(());
    }
    let (team, leader) = team(records, task)?;
    if author == leader
        || !records.list("memberships").iter().any(|m| {
            m.reference("teamId") == Some(team)
                && m.reference("agentId") == Some(author)
                && m.archived_at.is_none()
        })
    {
        return Ok(());
    }
    if records
        .list("comments")
        .iter()
        .any(|c| c.reference("sourceSummaryId") == Some(summary))
    {
        return Ok(());
    }
    let synthesis = records.get("tasks", task)?.data["currentSummary"]
        .as_str()
        .unwrap_or("")
        .to_owned();
    let body = format!("Worker execution summary {summary}\n\n{synthesis}\n\nRead the execution summary and pending items in this task's Conversation. This notice does not request an automatic reply.");
    let comment = records.insert(Record::new("comments",json!({"taskId":task,"body":body,"actorId":author,"actorKind":"agent","sourceSummaryId":summary,"mentionedAgentIds":[leader]})));
    enqueue(
        records,
        task,
        comment,
        leader,
        "worker_summary",
        summary,
        false,
    )
}
pub fn recipients(body: &Value) -> Result<Vec<Uuid>> {
    body.get("mentionedAgentIds")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|v| crate::dto::backend::value_id(v))
        .collect()
}

/// Called only within the serialized write unit; claim and destination are atomic.
pub fn claim(records: &mut Records, id: Uuid, installation: &str) -> Result<bool> {
    let delivery = records.get("session_deliveries", id)?.clone();
    if !matches!(
        delivery.data["state"].as_str(),
        Some("pending" | "waiting_binding")
    ) {
        return Ok(false);
    }
    let target = delivery
        .reference("targetAgentId")
        .ok_or_else(Failure::missing)?;
    let task = delivery.reference("taskId").ok_or_else(Failure::missing)?;
    if !records.get("agents", target)?.data["managedConfiguration"].is_null() {
        return Ok(false);
    }
    let binding = active_binding(records, target).cloned();
    if !task_active(records, task)
        || member(records, task, target).is_err()
        || (delivery.reference("bindingId").is_some()
            && delivery.reference("bindingId") != binding.as_ref().map(|b| b.id))
    {
        let row = records.get_mut("session_deliveries", id)?;
        row.data["state"] = json!("superseded");
        row.data["errorCode"] = json!("destination_changed");
        row.touch();
        return Ok(false);
    }
    let Some(binding) = binding else {
        return Ok(false);
    };
    // Missing mode is a legacy external declaration, never authority to take
    // over a Desktop session. The message remains readable through Conversation.
    if binding.data["mode"] != "integrated" {
        let row = records.get_mut("session_deliveries", id)?;
        row.data["state"] = json!("waiting_external");
        row.touch();
        return Ok(false);
    }
    if binding.data["installationId"] != installation {
        return Ok(false);
    }
    if records.list("leader_chat_turns").iter().any(|r| {
        r.reference("bindingId") == Some(binding.id)
            && !crate::dto::leader_chat::terminal(r.data["status"].as_str().unwrap_or(""))
    }) {
        return Ok(false);
    }
    if records.list("session_deliveries").iter().any(|r| {
        r.id != id
            && r.reference("bindingId") == Some(binding.id)
            && matches!(
                r.data["state"].as_str(),
                Some("dispatching" | "acknowledged" | "uncertain")
            )
    }) {
        return Ok(false);
    }
    let row = records.get_mut("session_deliveries", id)?;
    row.data["bindingId"] = json!(binding.id);
    row.data["destination"] = json!({"harness":binding.data["harness"],"installationId":binding.data["installationId"],"externalId":binding.data["externalId"],"projectRoot":binding.data["projectRoot"]});
    row.data["state"] = json!("dispatching");
    row.touch();
    Ok(true)
}
