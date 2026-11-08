//! Runtime observation never holds a database snapshot while starting a provider.
use super::{rules, LeaderChatService};
use crate::dto::{
    backend::{Command, Result},
    session_delivery::SessionDestination,
};
use serde_json::{json, Value};
impl LeaderChatService {
    pub(super) async fn runtime(&self, c: Command) -> Result<Value> {
        let agent = c.id("agentId")?;
        let u = self.store.read(&c).await?;
        u.records.get("agents", agent)?;
        let binding = rules::binding(&u.records, agent).ok().cloned();
        let busy = !u.records.list("leader_chat_turns").is_empty()
            || !u.records.list("session_deliveries").is_empty();
        u.rollback().await?;
        let integrated = binding
            .as_ref()
            .is_some_and(|b| b.data["mode"] == "integrated");
        let owned = binding
            .as_ref()
            .is_some_and(|b| b.data["installationId"] == self.installation);
        let supported = integrated && owned && self.provider.is_some();
        let mut observed = json!({"readiness":"unavailable","tools":{"webSearch":"disabled","networkAccess":false,"skills":[],"mcpServers":[]}});
        // Metadata from an external binding must never start or resume its harness.
        if integrated && owned {
            if let (Some(provider), Some(b)) = (&self.provider, &binding) {
                if let Ok(target) = serde_json::from_value::<SessionDestination>(b.data.clone()) {
                    observed = match provider.inspect(&target, &b.data["toolProfile"]).await {
                        Ok(v) => v,
                        Err(e) => {
                            json!({"readiness":if e.code=="needs_auth"{"needs_auth"}else{"unavailable"},"tools":{"webSearch":"disabled","networkAccess":false,"skills":[],"mcpServers":[]}})
                        }
                    };
                }
            }
        }
        let readiness = if !integrated {
            json!("external")
        } else if !owned {
            json!("unavailable")
        } else if busy {
            json!("busy")
        } else {
            observed["readiness"].clone()
        };
        Ok(
            json!({"agentId":agent,"mode":if integrated{"integrated"}else{"external"},"harness":binding.as_ref().and_then(|b|b.data["harness"].as_str()).unwrap_or("codex"),"bindingId":binding.as_ref().map(|b|b.id),"readiness":readiness,
   "capabilities":{"streaming":supported,"resume":supported,"interrupt":supported,"approvals":supported,"skills":supported,"mcp":supported,"webSearch":supported},"tools":observed["tools"]}),
        )
    }
}
