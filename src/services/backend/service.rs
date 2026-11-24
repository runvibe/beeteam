use crate::{
    dto::backend::{Command, Outcome, Result},
    repositories::contracts::{ProjectDiscovery, ResourceStore},
};
use serde_json::Value;
use std::sync::Arc;

/// HTTP and MCP share one application service; neither transport constructs storage.
pub struct BackendService {
    repository: Arc<dyn ResourceStore>,
    discovery: Arc<dyn ProjectDiscovery>,
}
impl BackendService {
    pub(crate) fn resources(&self) -> Arc<dyn ResourceStore> { self.repository.clone() }
    pub fn new(repository: Arc<dyn ResourceStore>, discovery: Arc<dyn ProjectDiscovery>) -> Self {
        Self {
            repository,
            discovery,
        }
    }
    pub async fn execute(&self, command: Command) -> Result<Outcome> {
        let op = crate::dto::contracts::operation(&command.operation)?;
        let mut result = super::execute(self.repository.as_ref(), self.discovery.as_ref(), command).await?;
        crate::dto::worker_contract::response(op, &mut result.data, false)?;
        Ok(result)
    }
    /// Idempotently creates the protected Bee Team HQ onboarding workspace.
    pub async fn ensure_onboarding(&self) -> Result<super::onboarding::OnboardingIds> {
        super::onboarding::ensure(self.repository.as_ref()).await
    }
    pub async fn execute_compound(&self, name: &str, input: Value) -> Result<Value> {
        let mut result = super::composite::execute(self.repository.as_ref(), name, input).await?;
        if let Some(def) = crate::dto::mcp::composite_tools().iter().find(|d| d["name"] == name) {
            crate::dto::worker_contract::transform(&def["outputSchema"], &def["outputSchema"], &mut result, false, false)?;
        }
        Ok(result)
    }
}
