//! Shared writable conversation preparation for text requests and voice history.
use super::*;

pub(super) fn prepare(
    records: &mut Records,
    id: Uuid,
    b: &SendAgentRequest,
    installation: &str,
) -> Result<Record> {
    let a = records.get("agents", id)?.clone();
    let team_chat = if let Some(cid) = b.conversation_id {
        records
            .get("managed_conversations", cid)?
            .reference("teamId")
            .is_some()
    } else {
        b.team_id.is_some()
    };
    if a.archived_at.is_some() || (a.data["managedConfiguration"].is_null() && !team_chat) {
        return Err(Failure::new(
            "invalid_request",
            "Configure an active agent before sending",
        ));
    }
    if let Some(t) = b.task_id {
        let task = records.get("tasks", t)?;
        if task.archived_at.is_some() {
            return Err(Failure::invalid("Task archived"));
        }
    }
    let generation = if a.data["managedConfiguration"].is_null() {
        json!(1)
    } else {
        a.data["managedGeneration"].clone()
    };
    let conversation = if let Some(cid) = b.conversation_id {
        let row = records.get("managed_conversations", cid)?;
        if row.reference("agentId") != Some(id)
            || b.task_id
                .is_some_and(|t| row.reference("taskId") != Some(t))
        {
            return Err(Failure::new(
                "conversation_mismatch",
                "Conversation belongs to another context",
            ));
        }
        if row.data["configurationVersion"] != generation || row.data["readOnly"] == true {
            return Err(Failure::new(
                "configuration_changed",
                "Start a new conversation after configuration changes",
            ));
        }
        if row.data["installationId"] != installation {
            return Err(Failure::new(
                "provider_unavailable",
                "Continue this conversation on its original installation, or start a new conversation here",
            ));
        }
        if b.team_id
            .is_some_and(|t| row.reference("teamId") != Some(t))
            || b.board_id
                .is_some_and(|t| row.reference("boardId") != Some(t))
        {
            return Err(Failure::new(
                "conversation_mismatch",
                "Conversation belongs to another context",
            ));
        }
        let row = records.get_mut("managed_conversations", cid)?;
        row.touch();
        row.clone()
    } else {
        if let Some(team) = b.team_id {
            sessions::team_leader(&records, team, id)?;
            if let Some(board) = b.board_id {
                sessions::team_board(&records, team, board)?;
            }
        }
        let row = Record::new(
            "managed_conversations",
            json!({"agentId":id,"configurationVersion":generation,"taskId":b.task_id,"teamId":b.team_id,"boardId":b.board_id,"title":b.content.chars().take(60).collect::<String>(),"readOnly":false,"providerThread":null,"installationId":installation}),
        );
        records.insert(row.clone());
        row
    };
    validate_context(&records, id, conversation.reference("taskId"))?;
    Ok(conversation)
}
