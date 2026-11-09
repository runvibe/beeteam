//! Canonical Conversation routing inside the same mutation transaction.
use super::*;
pub fn enqueue(
    records: &mut Records,
    task: Uuid,
    comment: Uuid,
    target: Uuid,
    kind: &str,
    source: Uuid,
    expects_reply: bool,
) -> Result<bool> {
    let a = records.get("agents", target)?.clone();
    if a.data["managedConfiguration"].is_null() {
        return Ok(false);
    }
    if records.list("session_deliveries").iter().any(|r| {
        r.reference("sourceId") == Some(source)
            && r.reference("targetAgentId") == Some(target)
            && r.data["kind"] == kind
            && r.data["state"] != "managed_backpressure"
    }) {
        return Ok(true);
    }
    let pending = records
        .list("session_deliveries")
        .iter()
        .find(|r| {
            r.reference("sourceId") == Some(source)
                && r.reference("targetAgentId") == Some(target)
                && r.data["kind"] == kind
                && r.data["state"] == "managed_backpressure"
        })
        .map(|r| r.id);
    if records
        .list("managed_requests")
        .iter()
        .filter(|r| r.reference("agentId") == Some(target) && !terminal(&r.data["state"]))
        .count()
        >= 32
    {
        if pending.is_none() {
            let message = records.get("comments", comment)?;
            let row = Record::new(
                "session_deliveries",
                json!({"taskId":task,"commentId":comment,"sourceId":source,"kind":kind,"targetAgentId":target,"requesterAgentId":message.data["actorId"],"state":"managed_backpressure","expectsReply":expects_reply,"originBindingId":null,"bindingId":null,"destination":null,"turnId":null,"errorCode":null,"replyCommentId":null}),
            );
            records.insert(row);
        }
        return Ok(true);
    }
    let message = records.get("comments", comment)?.clone();
    let conversation=records.list("managed_conversations").iter().find(|c|c.reference("agentId")==Some(target)&&c.reference("taskId")==Some(task)&&c.data["configurationVersion"]==a.data["managedGeneration"]&&c.data["readOnly"]!=true&&c.data["canonical"]==true).map(|r|(*r).clone()).unwrap_or_else(||Record::new("managed_conversations",json!({"agentId":target,"taskId":task,"configurationVersion":a.data["managedGeneration"],"title":"Task Conversation","canonical":true,"readOnly":false,"providerThread":null,"installationId":a.data["managedInstallation"]})));
    records.insert(conversation.clone());
    let request = Record::new(
        "managed_requests",
        json!({"agentId":target,"conversationId":conversation.id,"taskId":task,"configurationVersion":a.data["managedGeneration"],"state":"queued","origin":{"transport":if kind=="worker_summary"{"summary_notice"}else{"conversation"},"label":null},"content":message.data["body"],"error":null,"providerTurn":null}),
    );
    records.insert(Record::new("managed_messages",json!({"conversationId":conversation.id,"requestId":request.id,"role":"requester","content":message.data["body"]})));
    let mut delivery = Record::new(
        "session_deliveries",
        json!({"taskId":task,"commentId":comment,"sourceId":source,"kind":kind,"targetAgentId":target,"requesterAgentId":message.data["actorId"],"originBindingId":null,"bindingId":null,"destination":null,"state":"managed","managedRequestId":request.id,"turnId":null,"errorCode":null,"expectsReply":expects_reply,"replyCommentId":null}),
    );
    if let Some(id) = pending {
        delivery.id = id;
        delivery.version = records.get("session_deliveries", id)?.version + 1;
        delivery.created_at = records.get("session_deliveries", id)?.created_at;
    }
    records.insert(delivery);

    records.insert(request.clone());
    event(records, request.id)?;
    Ok(true)
}
pub fn complete(records: &mut Records, request: Uuid) -> Result<()> {
    let Some(delivery) = records
        .list("session_deliveries")
        .iter()
        .find(|d| d.reference("managedRequestId") == Some(request))
        .map(|d| (*d).clone())
    else {
        return Ok(());
    };
    if delivery.data["state"] == "completed" {
        return Ok(());
    }
    let row = records.get("managed_requests", request)?;
    if row.data["state"] != "completed" {
        if terminal(&row.data["state"]) || row.data["state"] == "uncertain" {
            let state = row.data["state"].clone();
            let d = records.get_mut("session_deliveries", delivery.id)?;
            d.data["state"] = state;
            d.touch();
        }
        return Ok(());
    }
    let text = records
        .list("managed_messages")
        .iter()
        .find(|m| m.reference("requestId") == Some(request) && m.data["role"] == "agent")
        .and_then(|m| m.data["content"].as_str())
        .unwrap_or("")
        .to_owned();
    let mut reply = None;
    if delivery.data["expectsReply"] == true && !text.is_empty() {
        let task = delivery.reference("taskId").unwrap();
        let target = delivery.reference("targetAgentId").unwrap();
        let text = if text.len() > 16000 {
            format!("Response available in managed request {request}. Open the agent conversation to read the full result.")
        } else {
            text
        };
        let cid=records.insert(Record::new("comments",json!({"taskId":task,"body":text,"actorId":target,"actorKind":"agent","inReplyToCommentId":delivery.data["commentId"],"deliveryId":delivery.id})));
        records.get_mut("tasks", task)?.touch();
        reply = Some(cid);
        if let Some(origin) = delivery.reference("requesterAgentId") {
            crate::services::managed_sessions::queue::enqueue(
                records,
                task,
                cid,
                origin,
                "response",
                delivery.id,
                false,
            )?;
        }
    }
    let d = records.get_mut("session_deliveries", delivery.id)?;
    d.data["state"] = json!("completed");
    d.data["replyCommentId"] = json!(reply);
    d.touch();
    Ok(())
}

pub async fn retry_notifications(service: &ManagedAgentService, ids: Vec<Uuid>) -> Result<()> {
    for id in ids {
        let mut u = service.store.begin().await?;
        let d = u.records.get("session_deliveries", id)?.clone();
        if d.data["state"] == "managed_backpressure" {
            enqueue(
                &mut u.records,
                d.reference("taskId").unwrap(),
                d.reference("commentId").unwrap(),
                d.reference("targetAgentId").unwrap(),
                d.data["kind"].as_str().unwrap(),
                d.reference("sourceId").unwrap(),
                d.data["expectsReply"] == true,
            )?;
        }
        u.commit().await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn internal_notice_survives_full_queue_and_retries_once() {
        let mut r = Records::default();
        let a = Record::new(
            "agents",
            json!({"managedConfiguration":{},"managedGeneration":1,"managedInstallation":"test"}),
        );
        let agent = a.id;
        r.insert(a);
        let task = Uuid::now_v7();
        let c = Record::new("comments", json!({"body":"Notice","actorId":null}));
        let comment = c.id;
        r.insert(c);
        let mut requests = vec![];
        for _ in 0..32 {
            let q = Record::new(
                "managed_requests",
                json!({"agentId":agent,"state":"queued"}),
            );
            requests.push(q.id);
            r.insert(q);
        }
        enqueue(
            &mut r,
            task,
            comment,
            agent,
            "worker_summary",
            comment,
            false,
        )
        .unwrap();
        enqueue(
            &mut r,
            task,
            comment,
            agent,
            "worker_summary",
            comment,
            false,
        )
        .unwrap();
        assert_eq!(r.list("managed_requests").len(), 32);
        assert_eq!(r.list("session_deliveries").len(), 1);
        assert_eq!(
            r.list("session_deliveries")[0].data["state"],
            "managed_backpressure"
        );
        r.get_mut("managed_requests", requests[0]).unwrap().data["state"] = json!("completed");
        enqueue(
            &mut r,
            task,
            comment,
            agent,
            "worker_summary",
            comment,
            false,
        )
        .unwrap();
        assert_eq!(r.list("session_deliveries").len(), 1);
        assert_eq!(r.list("session_deliveries")[0].data["state"], "managed");
        enqueue(
            &mut r,
            task,
            comment,
            agent,
            "worker_summary",
            comment,
            false,
        )
        .unwrap();
        assert_eq!(r.list("managed_requests").len(), 33);
    }
}
