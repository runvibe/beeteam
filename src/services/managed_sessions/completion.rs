//! Canonical Conversation completion shared by live delivery and explicit reconciliation.
use super::queue;
use crate::{
    dto::backend::{Failure, Result},
    repositories::records::{Record, Records},
};
use serde_json::json;
use uuid::Uuid;
pub fn complete(records: &mut Records, id: Uuid, turn_id: &str, text: &str) -> Result<()> {
    let row = records.get("session_deliveries", id)?.clone();
    if row.data["state"] == "completed" {
        return Ok(());
    }
    if row.data["turnId"].as_str() != Some(turn_id) {
        return Err(Failure::invalid("Provider completed another turn"));
    }
    let mut reply = None;
    if row.data["expectsReply"] == true && !text.is_empty() {
        if text.len() > 16384 {
            return Err(Failure::invalid(
                "Provider reply exceeds Conversation limit",
            ));
        }
        let task = row.reference("taskId").ok_or_else(Failure::missing)?;
        let target = row
            .reference("targetAgentId")
            .ok_or_else(Failure::missing)?;
        let cid=records.insert(Record::new("comments",json!({"taskId":task,"body":text,"actorId":target,"actorKind":"agent","inReplyToCommentId":row.data["commentId"],"deliveryId":id})));
        records.get_mut("tasks", task)?.touch();
        reply = Some(cid);
        if let Some(origin) = row.reference("requesterAgentId") {
            if records
                .get("agents", origin)
                .is_ok_and(|a| !a.data["managedConfiguration"].is_null())
                || row.reference("originBindingId").is_some()
                    && queue::active_binding(&records, origin).map(|b| b.id)
                        == row.reference("originBindingId")
            {
                queue::enqueue(records, task, cid, origin, "response", id, false)?;
            }
        }
    }
    let row = records.get_mut("session_deliveries", id)?;
    row.data["state"] = json!("completed");
    row.data["turnId"] = json!(turn_id);
    row.data["replyCommentId"] = json!(reply);
    row.touch();
    Ok(())
}
