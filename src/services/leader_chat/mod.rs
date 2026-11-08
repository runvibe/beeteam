//! Integrated chat orchestration. HTTP and provider transports stay outside this service.
mod bootstrap;
mod execution;
mod recovery;
pub mod rules;
mod runtime;
mod startup;
pub mod worker_delivery;
use crate::{
    dto::backend::*,
    repositories::{
        contracts::ResourceStore,
        integrated_provider::{Control, IntegratedProvider},
        records::Record,
    },
};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashMap},
    sync::Arc,
};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;
#[derive(Clone)]
pub struct LeaderChatService {
    pub(crate) store: Arc<dyn ResourceStore>,
    pub(crate) provider: Option<Arc<dyn IntegratedProvider>>,
    pub(crate) installation: String,
    pub(crate) controls: Arc<Mutex<HashMap<Uuid, mpsc::Sender<Control>>>>,
    recovered: Arc<tokio::sync::OnceCell<()>>,
}
impl LeaderChatService {
    pub fn is_configured(&self) -> bool {
        self.provider.is_some()
    }
    pub fn new(store: Arc<dyn ResourceStore>) -> Self {
        Self {
            store,
            provider: None,
            installation: String::new(),
            controls: Arc::new(Mutex::new(HashMap::new())),
            recovered: Arc::new(tokio::sync::OnceCell::new()),
        }
    }
    pub fn with_provider(
        mut self,
        provider: Arc<dyn IntegratedProvider>,
        installation: String,
    ) -> Self {
        self.provider = Some(provider);
        self.installation = installation;
        self
    }
    pub async fn read(&self, c: Command) -> Result<Value> {
        self.recover().await?;
        if c.operation == "integrated:runtime" {
            return self.runtime(c).await;
        }
        let u = self.store.read(&c).await?;
        let r = &u.records;
        let result = match c.operation.as_str() {
            "integrated:list" => {
                let limit = c.q("limit").as_u64().unwrap_or(50).clamp(1, 100) as usize;
                let mut rows = r.list("leader_chats");
                rows.sort_by_key(|r| std::cmp::Reverse(r.id));
                let more = rows.len() > limit;
                rows.truncate(limit);
                json!({"items":rows.iter().map(|r|rules::project(r)).collect::<Vec<_>>(),"nextCursor":if more{rows.last().map(|r|r.id.to_string())}else{None}})
            }
            "integrated:snapshot" | "integrated:messages" => {
                let chat = r.get("leader_chats", c.id("chatId")?)?;
                let limit = if c.operation == "integrated:snapshot" {
                    50
                } else {
                    c.q("limit").as_u64().unwrap_or(50).clamp(1, 100) as usize
                };
                let mut rows = r.list("leader_chat_messages");
                rows.sort_by_key(|r| std::cmp::Reverse(r.id));
                let more = rows.len() > limit;
                rows.truncate(limit);
                let cursor = if more {
                    rows.last().map(|r| r.id.to_string())
                } else {
                    None
                };
                rows.reverse();
                let messages = rows
                    .iter()
                    .map(|r| rules::visible_message(r))
                    .collect::<Vec<_>>();
                if c.operation == "integrated:messages" {
                    json!({"items":messages,"nextCursor":cursor})
                } else {
                    let latest = r
                        .list("leader_chat_events")
                        .iter()
                        .map(|r| r.id)
                        .max()
                        .unwrap_or(Uuid::nil());
                    json!({"chat":rules::project(chat),"messages":messages,"olderMessagesCursor":cursor,"activeTurn":r.list("leader_chat_turns").first().map(|r|rules::project(r)),"pendingApprovals":r.list("leader_chat_approvals").iter().map(|r|rules::project(r)).collect::<Vec<_>>(),"toolActivities":r.list("leader_chat_tools").iter().map(|t|{let mut v=t.data.clone();v["id"]=json!(t.id);v["revision"]=json!(t.version);v.as_object_mut().unwrap().remove("chatId");v}).collect::<Vec<_>>(),"eventCursor":format!("{}:{latest}",chat.id)})
                }
            }
            "integrated:turn" => {
                let row = r.get("leader_chat_turns", c.id("turnId")?)?;
                if row.reference("chatId") != Some(c.id("chatId")?) {
                    return Err(Failure::missing());
                }
                rules::project(row)
            }
            "integrated:events" => {
                let mut rows = r.list("leader_chat_events");
                rows.sort_by_key(|r| r.id);
                json!(rows.iter().map(|r| r.data.clone()).collect::<Vec<_>>())
            }
            _ => return Err(Failure::invalid("Unknown chat operation")),
        };
        u.rollback().await?;
        Ok(result)
    }
    pub async fn write(&self, c: Command) -> Result<Outcome> {
        self.recover().await?;
        let actor = c.actor()?;
        actor.validate()?;
        let key = c
            .idempotency_key
            .ok_or_else(|| Failure::invalid("Idempotency-Key required"))?;
        let op = format!(
            "{}:{}",
            c.operation,
            serde_json::to_string(&c.params).unwrap()
        );
        let hash =
            serde_json::to_string(&json!({"body":c.body,"version":c.expected_version})).unwrap();
        let mut u = self.store.begin().await?;
        if let Some(id) = actor.id {
            u.records.get("agents", id)?;
        }
        if let Some(out) = u.replay(&actor.key(), &op, key, &hash).await? {
            u.rollback().await?;
            return Ok(out);
        }
        if c.operation == "integrated:send" && self.provider.is_none() {
            return Err(Failure::new(
                "session_not_ready",
                "Integrated Codex runtime is not configured",
            ));
        }
        if c.operation == "integrated:send" {
            let chat = u.records.get("leader_chats", c.id("chatId")?)?;
            if rules::active_binding(&u.records, chat)?.data["installationId"] != self.installation
            {
                return Err(Failure::new(
                    "session_not_ready",
                    "Session belongs to another Bee Team installation",
                ));
            }
        }
        let out = match c.operation.as_str() {
            "integrated:create" => rules::create(&mut u.records, &c)?,
            "integrated:send" => rules::send(&mut u.records, &c)?,
            "integrated:cancel" => rules::cancel(&mut u.records, &c)?,
            "integrated:decision" => rules::decision(&mut u.records, &c)?,
            _ => return Err(Failure::invalid("Unknown chat mutation")),
        };
        u.save_replay(&actor.key(), &op, key, &hash, &out).await?;
        u.commit().await?;
        match c.operation.as_str() {
            "integrated:send" if out.created_id.is_some() => {
                let id = value_id(&out.data["turn"]["id"])?;
                let this = self.clone();
                tokio::spawn(async move {
                    if let Err(e) = this.execute_turn(id).await {
                        tracing::warn!(code=%e.code,"Integrated turn orchestration failed");
                    }
                });
            }
            "integrated:cancel" => {
                if let Some(tx) = self.controls.lock().await.get(&c.id("turnId")?).cloned() {
                    let _ = tx.send(Control::Cancel).await;
                }
            }
            "integrated:decision" => {
                let id = value_id(&out.data["turnId"])?;
                if let Some(tx) = self.controls.lock().await.get(&id).cloned() {
                    let _ = tx
                        .send(Control::Decision {
                            approval_id: c.id("approvalId")?,
                            accept: c.body["decision"] == "accept",
                        })
                        .await;
                }
            }
            _ => {}
        }
        Ok(out)
    }
}
pub fn command(operation: &str) -> Command {
    Command {
        operation: format!("integrated:{operation}"),
        params: BTreeMap::new(),
        query: BTreeMap::new(),
        body: Value::Null,
        actor: None,
        expected_version: None,
        idempotency_key: None,
        upload: None,
    }
}
