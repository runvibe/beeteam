//! Owned-agent orchestration; public identifiers belong exclusively to Bee Team.
pub mod conversation;
mod execution;
mod reads;
mod writes;
use crate::{
    dto::{backend::*, managed_agents::*},
    repositories::{
        contracts::ResourceStore,
        integrated_provider::{Control, IntegratedProvider},
        records::{Record, Records},
    },
};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::{mpsc, Mutex};
use uuid::Uuid;
#[derive(Clone)]
pub struct ManagedAgentService {
    store: Arc<dyn ResourceStore>,
    provider: Option<Arc<dyn IntegratedProvider>>,
    installation: String,
    controls: Arc<Mutex<HashMap<Uuid, mpsc::Sender<Control>>>>,
    recovery: Arc<tokio::sync::OnceCell<()>>,
}
impl ManagedAgentService {
    pub fn new(store: Arc<dyn ResourceStore>) -> Self {
        Self {
            store,
            provider: None,
            installation: String::new(),
            controls: Default::default(),
            recovery: Default::default(),
        }
    }
    pub fn with_provider(mut self, p: Arc<dyn IntegratedProvider>, installation: String) -> Self {
        self.provider = Some(p);
        self.installation = installation;
        self
    }
    pub async fn start(&self) -> Result<()> {
        self.recover().await
    }
    async fn recover(&self) -> Result<()> {
        if self.provider.is_none() {
            return Ok(());
        }
        self.recovery.get_or_try_init(|| async {
   let mut u=self.store.begin().await?;
   let ids:Vec<_>=u.records.list("managed_requests").iter().filter(|r|r.reference("conversationId").and_then(|id|u.records.get("managed_conversations",id).ok()).is_some_and(|c|c.data["installationId"]==self.installation)&&matches!(r.data["state"].as_str(),Some("preparing"|"running"|"awaiting_approval"))).map(|r|r.id).collect();
   for id in ids {transition(&mut u.records,id,"uncertain",json!({"code":"outcome_unknown","message":"Execution interrupted; reconcile the original request","retryable":false}))?;}
   let agents:Vec<_>=u.records.list("managed_requests").iter().filter(|r|r.data["state"]=="queued").filter_map(|r|r.reference("agentId")).collect();
   u.commit().await?;
   for agent in agents {self.schedule(agent);}
   let this=self.clone();tokio::spawn(async move {loop{tokio::time::sleep(std::time::Duration::from_secs(1)).await;let mut c=command("work");c.query.insert("installation".into(),json!(this.installation));if let Ok(u)=this.store.read(&c).await{let agents:std::collections::BTreeSet<_>=u.records.list("managed_requests").iter().filter_map(|r|r.reference("agentId")).collect();let outbox=u.records.list("session_deliveries").iter().map(|d|d.id).collect();let _=u.rollback().await;let _=conversation::retry_notifications(&this,outbox).await;for agent in agents{this.schedule(agent);}}}});
   Ok::<(),Failure>(())
  }).await?;
        Ok(())
    }
    fn schedule(&self, agent: Uuid) {
        let this = self.clone();
        tokio::spawn(async move {
            if let Err(e) = this.drain(agent).await {
                tracing::warn!(code=%e.code,"Managed request dispatch failed");
            }
        });
    }
}
pub fn command(op: &str) -> Command {
    let mut c = crate::services::leader_chat::command(op);
    c.operation = format!("managed:{op}");
    c
}
fn terminal(s: &Value) -> bool {
    matches!(s.as_str(), Some("completed" | "failed" | "cancelled"))
}
fn public(r: &Record) -> Value {
    let fields: &[&str] = match r.table {
        "managed_requests" => &[
            "agentId",
            "conversationId",
            "taskId",
            "configurationVersion",
            "state",
            "origin",
            "error",
        ],
        "managed_conversations" => &[
            "agentId",
            "configurationVersion",
            "taskId",
            "title",
            "readOnly",
        ],
        "managed_messages" => &["conversationId", "requestId", "role", "content"],
        "managed_approvals" => &[
            "requestId",
            "agentId",
            "kind",
            "description",
            "state",
            "expiresAt",
        ],
        _ => &[],
    };
    let mut v = json!({"id":r.id});
    for key in fields {
        v[*key] = r.data[*key].clone();
    }
    if r.table != "managed_conversations" {
        v["version"] = json!(r.version);
    }
    if r.table != "managed_approvals" {
        v["createdAt"] = json!(r.created_at);
    }
    if r.table == "managed_requests" {
        v["updatedAt"] = json!(r.updated_at);
    }
    v
}
fn check_version(r: &Record, c: &Command) -> Result<()> {
    match c.expected_version {
        None => Err(Failure::new("version_required", "If-Match required")),
        Some(v) if v != r.version => {
            Err(Failure::new("version_conflict", "Resource version changed"))
        }
        _ => Ok(()),
    }
}
fn transition(r: &mut Records, id: Uuid, state: &str, error: Value) -> Result<()> {
    let row = r.get_mut("managed_requests", id)?;
    if terminal(&row.data["state"]) {
        return Ok(());
    }
    row.data["state"] = json!(state);
    row.data["error"] = error;
    row.touch();
    if matches!(state, "failed" | "cancelled" | "uncertain") {
        let ids: Vec<_> = r
            .list("managed_approvals")
            .iter()
            .filter(|a| a.reference("requestId") == Some(id) && a.data["state"] == "pending")
            .map(|a| a.id)
            .collect();
        for aid in ids {
            let a = r.get_mut("managed_approvals", aid)?;
            a.data["state"] = json!("expired");
            a.touch();
        }
    }
    event(r, id)?;
    conversation::complete(r, id)
}
fn event(r: &mut Records, id: Uuid) -> Result<()> {
    let request = public(r.get("managed_requests", id)?);
    let mut e = Record::new(
        "managed_events",
        json!({"requestId":id,"schemaVersion":1,"type":"request.updated","request":request}),
    );
    e.data["cursor"] = json!(format!("{id}:{}", e.id));
    r.insert(e);
    Ok(())
}
fn configuration(r: &Records, agent: Uuid) -> Result<Value> {
    let a = r.get("agents", agent)?;
    let mut config = a.data["managedConfiguration"].clone();
    if let Some(fields) = config.as_object_mut() { fields.remove("projectRoot"); }
    Ok(
        json!({"agentId":agent,"version":a.version,"configuration":config,"readiness":if a.data["managedConfiguration"].is_null(){"unconfigured"}else{"configured"}}),
    )
}

fn validate_context(records: &Records, agent: Uuid, task: Option<Uuid>) -> Result<()> {
    if records.get("agents", agent)?.archived_at.is_some() {
        return Err(Failure::invalid("Agent archived"));
    }
    if let Some(task) = task {
        if !crate::services::managed_sessions::queue::task_active(records, task) {
            return Err(Failure::invalid("Task context is inactive"));
        }
        crate::services::managed_sessions::queue::member(records, task, agent)?;
    }
    Ok(())
}
