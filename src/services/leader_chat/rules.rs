//! Pure transactional chat rules shared by transport-independent service operations.
use crate::{
    dto::{backend::*, leader_chat::*},
    repositories::records::{Record, Records},
};
use chrono::Utc;
use serde_json::{json, Value};
use uuid::Uuid;

pub fn project(r: &Record) -> Value {
    let mut v = r.data.clone();
    v["id"] = json!(r.id);
    if r.table == "leader_chat_messages" {
        v["revision"] = json!(r.version);
    } else if r.table != "leader_chat_events" {
        v["version"] = json!(r.version);
    }
    if r.table != "leader_chat_events" && r.table != "leader_chat_approvals" {
        v["createdAt"] = json!(r.created_at);
    }
    for key in ["providerTurnId", "ownerAgentId", "sourceDeliveryId"] {
        v.as_object_mut().unwrap().remove(key);
    }
    if r.table == "leader_chat_turns" {
        v.as_object_mut().unwrap().remove("taskId");
    }
    if matches!(r.table, "leader_chats" | "leader_chat_turns") {
        v["updatedAt"] = json!(r.updated_at);
    }
    v
}
pub fn binding<'a>(records: &'a Records, agent: Uuid) -> Result<&'a Record> {
    records
        .list("agent_session_bindings")
        .into_iter()
        .find(|b| b.reference("agentId") == Some(agent) && b.data["endedAt"].is_null())
        .ok_or_else(|| Failure::new("session_not_ready", "Agent has no active session"))
}
pub fn active_binding(records: &Records, chat: &Record) -> Result<Record> {
    let b = binding(
        records,
        chat.reference("leaderAgentId")
            .ok_or_else(Failure::missing)?,
    )?;
    if b.data["mode"] != "integrated" {
        return Err(Failure::new(
            "external_mode",
            "This session is externally managed",
        ));
    }
    if Some(b.id) != chat.reference("bindingId") {
        return Err(Failure::new(
            "session_binding_conflict",
            "Chat belongs to a previous binding",
        ));
    }
    Ok(b.clone())
}
pub fn create(records: &mut Records, c: &Command) -> Result<Outcome> {
    let req: CreateChat =
        serde_json::from_value(c.body.clone()).map_err(|e| Failure::invalid(e.to_string()))?;
    if req.title.trim().is_empty() || req.title.chars().count() > 120 {
        return Err(Failure::invalid("Invalid chat title"));
    }
    let team = records.get("teams", req.team_id)?;
    if team.reference("leaderId") != Some(req.leader_agent_id) {
        return Err(Failure::new(
            "session_binding_conflict",
            "Agent is not this team's leader",
        ));
    }
    let b = binding(records, req.leader_agent_id)?;
    if b.id != req.binding_id {
        return Err(Failure::new("session_binding_conflict", "Binding changed"));
    }
    if b.data["mode"] != "integrated" {
        return Err(Failure::new(
            "external_mode",
            "Create an integrated session first",
        ));
    }
    if let Some(chat) = records
        .list("leader_chats")
        .into_iter()
        .find(|r| r.reference("bindingId") == Some(req.binding_id))
    {
        return Ok(Outcome::data(project(chat)));
    }
    let row = Record::new(
        "leader_chats",
        json!({"teamId":req.team_id,"leaderAgentId":req.leader_agent_id,"bindingId":req.binding_id,"title":req.title.trim()}),
    );
    let value = project(&row);
    let id = records.insert(row);
    let mut out = Outcome::data(value);
    out.created_id = Some(id);
    Ok(out)
}
pub fn send(records: &mut Records, c: &Command) -> Result<Outcome> {
    let req: SendMessage =
        serde_json::from_value(c.body.clone()).map_err(|e| Failure::invalid(e.to_string()))?;
    req.validate()?;
    let chat = records.get("leader_chats", c.id("chatId")?)?.clone();
    if let Some(old) = records.list("leader_chat_messages").into_iter().find(|r| {
        r.reference("chatId") == Some(chat.id)
            && r.reference("clientMessageId") == Some(req.client_message_id)
    }) {
        if old.data["content"] != req.content
            || old.reference("taskId") != req.task_id
            || old.data["requestBindingId"] != json!(req.binding_id)
        {
            return Err(Failure::new(
                "idempotency_conflict",
                "clientMessageId was already used",
            ));
        }
        return Ok(Outcome::data(old.data["initialResult"].clone()));
    }
    let b = active_binding(records, &chat)?;
    if req.binding_id != b.id {
        return Err(Failure::new("session_binding_conflict", "Binding changed"));
    }
    if let Some(task_id) = req.task_id {
        let task = records.get("tasks", task_id)?;
        let board = records.get(
            "boards",
            task.reference("boardId").ok_or_else(Failure::missing)?,
        )?;
        if board.reference("teamId") != chat.reference("teamId") {
            return Err(Failure::invalid("Task belongs to another team"));
        }
    }
    if records.list("session_deliveries").iter().any(|d| {
        d.reference("bindingId") == Some(b.id)
            && matches!(
                d.data["state"].as_str(),
                Some("dispatching" | "acknowledged" | "uncertain")
            )
    }) {
        return Err(Failure::new(
            "turn_in_progress",
            "A Conversation delivery is using this binding",
        ));
    }
    if records.list("leader_chat_turns").iter().any(|t| {
        t.reference("bindingId") == Some(b.id) && !terminal(t.data["status"].as_str().unwrap_or(""))
    }) {
        return Err(Failure::new(
            "turn_in_progress",
            "There is already a turn for this session",
        ));
    }
    let turn = Record::new(
        "leader_chat_turns",
        json!({"chatId":chat.id,"bindingId":b.id,"status":"queued","failure":null}),
    );
    let turn_id = turn.id;
    let turn_value = project(&turn);
    records.insert(turn);
    let mut msg = Record::new(
        "leader_chat_messages",
        json!({"chatId":chat.id,"turnId":turn_id,"role":"user","content":req.content,"taskId":req.task_id,"clientMessageId":req.client_message_id}),
    );
    let msg_value = project(&msg);
    let result = json!({"message":msg_value,"turn":turn_value});
    msg.data["requestBindingId"] = json!(req.binding_id);
    msg.data["initialResult"] = result.clone();
    records.insert(msg);
    event(
        records,
        chat.id,
        turn_id,
        "message.updated",
        json!({"message":msg_value}),
    );
    event(
        records,
        chat.id,
        turn_id,
        "turn.updated",
        json!({"turn":turn_value}),
    );
    let mut out = Outcome::data(result);
    out.created_id = Some(turn_id);
    Ok(out)
}
pub fn visible_message(r: &Record) -> Value {
    let mut v = project(r);
    v.as_object_mut().unwrap().remove("initialResult");
    v.as_object_mut().unwrap().remove("requestBindingId");
    v
}
pub fn event(records: &mut Records, chat: Uuid, turn: Uuid, kind: &str, data: Value) -> Uuid {
    let mut row = Record::new(
        "leader_chat_events",
        json!({"schemaVersion":1,"chatId":chat,"turnId":turn,"type":kind,"data":data}),
    );
    row.data["id"] = json!(format!("{chat}:{}", row.id));
    row.data["createdAt"] = json!(row.created_at);
    records.insert(row)
}
pub fn transition(
    records: &mut Records,
    turn: Uuid,
    status: &str,
    failure: Value,
) -> Result<Value> {
    let row = records.get_mut("leader_chat_turns", turn)?;
    if terminal(row.data["status"].as_str().unwrap_or("")) {
        return Ok(project(row));
    }
    row.data["status"] = json!(status);
    row.data["failure"] = failure;
    row.touch();
    let chat = row.reference("chatId");
    let v = project(row);
    if records.get("leader_chat_turns", turn)?.data["sourceDeliveryId"].is_null() {
        event(
            records,
            chat.ok_or_else(Failure::missing)?,
            turn,
            "turn.updated",
            json!({"turn":v}),
        );
    }
    if terminal(status) || status == "uncertain" {
        let ids: Vec<_> = records
            .list("leader_chat_approvals")
            .iter()
            .filter(|r| r.reference("turnId") == Some(turn) && r.data["status"] == "pending")
            .map(|r| r.id)
            .collect();
        for id in ids {
            let a = records.get_mut("leader_chat_approvals", id)?;
            a.data["status"] = json!("expired");
            a.touch();
            let owner = a.reference("chatId");
            let approval = project(a);
            if let Some(owner) = owner {
                event(
                    records,
                    owner,
                    turn,
                    "approval.updated",
                    json!({"approval":approval}),
                );
            }
        }
    }
    Ok(v)
}
pub fn check_version(r: &Record, expected: Option<i64>) -> Result<()> {
    let v = expected.ok_or_else(|| Failure::new("version_required", "If-Match is required"))?;
    if r.version != v {
        return Err(Failure::new("version_conflict", "Resource version changed"));
    }
    Ok(())
}
pub fn cancel(records: &mut Records, c: &Command) -> Result<Outcome> {
    let id = c.id("turnId")?;
    let t = records.get("leader_chat_turns", id)?;
    if t.reference("chatId") != Some(c.id("chatId")?) {
        return Err(Failure::missing());
    }
    check_version(t, c.expected_version)?;
    if t.data["status"] == "uncertain" {
        return Err(Failure::new(
            "reconciliation_required",
            "Reconcile the provider turn before requesting cancellation",
        ));
    }
    let state = if t.data["status"] == "queued" {
        "cancelled"
    } else {
        "cancel_requested"
    };
    let v = transition(records, id, state, Value::Null)?;
    Ok(Outcome::data(v))
}
pub fn decision(records: &mut Records, c: &Command) -> Result<Outcome> {
    let req: ApprovalDecision =
        serde_json::from_value(c.body.clone()).map_err(|e| Failure::invalid(e.to_string()))?;
    if !matches!(req.decision.as_str(), "accept" | "decline") {
        return Err(Failure::invalid("Decision must be accept or decline"));
    }
    let id = c.id("approvalId")?;
    let a = records.get("leader_chat_approvals", id)?.clone();
    if a.reference("chatId") != Some(c.id("chatId")?) {
        return Err(Failure::missing());
    }
    check_version(&a, c.expected_version)?;
    let t = records.get(
        "leader_chat_turns",
        a.reference("turnId").ok_or_else(Failure::missing)?,
    )?;
    let b = records.get(
        "agent_session_bindings",
        a.reference("bindingId").ok_or_else(Failure::missing)?,
    )?;
    if a.data["status"] != "pending"
        || a.data["expiresAt"]
            .as_str()
            .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
            .is_none_or(|v| v <= Utc::now())
        || t.data["status"] != "waiting_approval"
        || !b.data["endedAt"].is_null()
    {
        return Err(Failure::new(
            "approval_expired",
            "Approval is no longer pending",
        ));
    }
    let row = records.get_mut("leader_chat_approvals", id)?;
    row.data["status"] = json!(if req.decision == "accept" {
        "accepted"
    } else {
        "declined"
    });
    row.touch();
    let v = project(row);
    event(
        records,
        c.id("chatId")?,
        a.reference("turnId").unwrap(),
        "approval.updated",
        json!({"approval":v}),
    );
    Ok(Outcome::data(v))
}

pub fn ensure_agent_idle(
    records: &crate::repositories::records::Records,
    agent: Uuid,
) -> Result<()> {
    let Some(binding) = binding(records, agent).ok() else {
        return Ok(());
    };
    if records.list("leader_chat_turns").iter().any(|r| {
        r.reference("bindingId") == Some(binding.id)
            && !crate::dto::leader_chat::terminal(r.data["status"].as_str().unwrap_or(""))
    }) || records.list("session_deliveries").iter().any(|r| {
        r.reference("bindingId") == Some(binding.id)
            && matches!(
                r.data["state"].as_str(),
                Some("dispatching" | "acknowledged" | "uncertain")
            )
    }) {
        return Err(Failure::new(
            "session_busy",
            "Finish or reconcile active work before replacing the session",
        ));
    }
    Ok(())
}
