use super::queue;
use crate::{
    dto::{
        backend::{Command, Failure, Result},
        session_delivery::*,
    },
    repositories::{
        contracts::{ResourceStore, SessionProvider},
        records::Record,
    },
};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;

pub struct ManagedSessionService {
    store: Arc<dyn ResourceStore>,
    provider: Arc<dyn SessionProvider>,
    installation: String,
}
impl ManagedSessionService {
    pub async fn run(
        self: Arc<Self>,
        _lease: crate::repositories::session_dispatch_lease::DispatchLease,
    ) -> Result<()> {
        self.recover().await?;
        // Independent sessions progress concurrently; claims serialize each binding.
        tokio::join!(self.worker(), self.worker());
        Ok(())
    }
    async fn worker(&self) {
        loop {
            if self.deliver_next().await.is_err() {
                tracing::warn!("Managed session dispatch failed; inspect delivery ledger");
            }
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }
    pub fn new(
        store: Arc<dyn ResourceStore>,
        provider: Arc<dyn SessionProvider>,
        installation: String,
    ) -> Self {
        Self {
            store,
            provider,
            installation,
        }
    }
    async fn candidates(&self, states: &[&str], offset: usize) -> Result<Vec<Uuid>> {
        let c = Command {
            operation: "listSessionDeliveryWork".into(),
            params: BTreeMap::new(),
            query: BTreeMap::from([
                ("states".into(), json!(states)),
                ("installationId".into(), json!(self.installation)),
                ("limit".into(), json!(100)),
                ("offset".into(), json!(offset)),
            ]),
            body: Value::Null,
            actor: None,
            expected_version: None,
            idempotency_key: None,
            upload: None,
        };
        let mut unit = self.store.read(&c).await?;
        let selected = unit.select(&c).await?;
        unit.rollback().await?;
        selected
            .items
            .iter()
            .map(|r| crate::dto::backend::value_id(&r["id"]))
            .collect()
    }
    /// Requires the installation's exclusive process lease. Never replay an unknown send.
    pub async fn recover(&self) -> Result<()> {
        loop {
            let ids = self.candidates(&["dispatching", "acknowledged"], 0).await?;
            if ids.is_empty() {
                return Ok(());
            }
            let mut unit = self.store.begin().await?;
            for id in ids {
                let row = unit.records.get_mut("session_deliveries", id)?;
                if matches!(
                    row.data["state"].as_str(),
                    Some("dispatching" | "acknowledged")
                ) {
                    row.data["state"] = json!("uncertain");
                    row.data["errorCode"] = json!("process_restarted");
                    row.touch();
                }
            }
            unit.commit().await?;
        }
    }
    pub async fn deliver_next(&self) -> Result<bool> {
        let mut offset = 0;
        loop {
            let ids = self
                .candidates(&["pending", "waiting_binding"], offset)
                .await?;
            let count = ids.len();
            for id in ids {
                let mut unit = self.store.begin().await?;
                if !queue::claim(&mut unit.records, id, &self.installation)? {
                    unit.commit().await?;
                    continue;
                }
                let row = unit.records.get("session_deliveries", id)?.clone();
                let destination: SessionDestination =
                    serde_json::from_value(row.data["destination"].clone())
                        .map_err(|_| Failure::invalid("Invalid saved destination"))?;
                let comment = unit.records.get(
                    "comments",
                    row.reference("commentId").ok_or_else(Failure::missing)?,
                )?;
                let text=format!("Bee Team Conversation\nTask: {}\nComment: {}\nDelivery: {}\nRecipient agent: {}\nSender agent (null means human): {}\nManaged mode: use this task's Conversation as the only communication channel. For independent questions or delegations, use Bee Team createComment with explicit mentionedAgentIds; do not message other harness chats. Worker execution summaries already generate leader notices, so do not duplicate those notices.\n{}\n\n{}",row.data["taskId"],comment.id,id,row.data["targetAgentId"],comment.data["actorId"],if row.data["expectsReply"]==true{"Return a direct reply as final text. Bee Team appends and routes it automatically; do not also create a duplicate reply comment."}else{"Informational notification. Do not send an automatic acknowledgement or notify other chats."},comment.data["body"].as_str().unwrap_or(""));
                unit.commit().await?;
                let (tx, mut rx) = tokio::sync::mpsc::channel(8);
                let delivery = self.provider.deliver(&destination, &text, tx);
                tokio::pin!(delivery);
                let mut complete = false;
                let mut receiving = true;
                loop {
                    tokio::select! {
                        event=rx.recv(), if receiving=> {
                            if let Some(event)=event {complete|=matches!(event,SessionEvent::Completed{..});self.checked_event(id,event).await?;}else{receiving=false;}
                        }
                        result=&mut delivery=> {
                            while let Ok(event)=rx.try_recv(){complete|=matches!(event,SessionEvent::Completed{..});self.checked_event(id,event).await?;}
                            match result {
                                Err(error)=>self.failure(id,error).await?,
                                Ok(()) if !complete=>self.failure(id,SessionFailure::new("missing_completion","Provider ended without a completed event",true)).await?,
                                _=>{}
                            }
                            return Ok(true);
                        }
                    }
                }
            }
            if count < 100 {
                return Ok(false);
            }
            offset += count;
        }
    }
    async fn checked_event(&self, id: Uuid, event: SessionEvent) -> Result<()> {
        if let Err(error) = self.event(id, event).await {
            let _ = self
                .failure(
                    id,
                    SessionFailure::new(
                        "persistence_failed",
                        "Provider event could not be persisted",
                        true,
                    ),
                )
                .await;
            return Err(error);
        }
        Ok(())
    }
    async fn failure(&self, id: Uuid, error: SessionFailure) -> Result<()> {
        let mut unit = self.store.begin().await?;
        let row = unit.records.get_mut("session_deliveries", id)?;
        if row.data["state"] != "completed" {
            row.data["state"] = json!(if error.uncertain {
                "uncertain"
            } else {
                "failed"
            });
            row.data["errorCode"] = json!(error.code);
            row.touch();
        }
        unit.commit().await
    }
    async fn event(&self, id: Uuid, event: SessionEvent) -> Result<()> {
        let mut unit = self.store.begin().await?;
        let row = unit.records.get("session_deliveries", id)?.clone();
        if row.data["state"] == "completed" {
            return unit.rollback().await;
        }
        match event {
            SessionEvent::Ready { backend_origin } => {
                let row = unit.records.get_mut("session_deliveries", id)?;
                row.data["backendOrigin"] = json!(backend_origin);
                row.touch();
            }
            SessionEvent::Accepted { turn_id } => {
                let row = unit.records.get_mut("session_deliveries", id)?;
                row.data["state"] = json!("acknowledged");
                row.data["turnId"] = json!(turn_id);
                row.touch();
            }
            SessionEvent::Completed { turn_id, text } => {
                if row.data["turnId"].as_str() != Some(&turn_id) {
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
                    let cid=unit.records.insert(Record::new("comments",json!({"taskId":task,"body":text,"actorId":target,"actorKind":"agent","inReplyToCommentId":row.data["commentId"],"deliveryId":id})));
                    unit.records.get_mut("tasks", task)?.touch();
                    reply = Some(cid);
                    if let Some(origin) = row.reference("requesterAgentId") {
                        if row.reference("originBindingId").is_some()
                            && queue::active_binding(&unit.records, origin).map(|b| b.id)
                                == row.reference("originBindingId")
                        {
                            queue::enqueue(
                                &mut unit.records,
                                task,
                                cid,
                                origin,
                                "response",
                                id,
                                false,
                            )?;
                        }
                    }
                }
                let row = unit.records.get_mut("session_deliveries", id)?;
                row.data["state"] = json!("completed");
                row.data["turnId"] = json!(turn_id);
                row.data["replyCommentId"] = json!(reply);
                row.touch();
            }
        }
        unit.commit().await
    }
}
