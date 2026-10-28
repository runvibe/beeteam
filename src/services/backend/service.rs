use crate::{
    dto::backend::{Command, Outcome, Result},
    repositories::contracts::ResourceStore,
};
use serde_json::Value;
use std::sync::Arc;

/// HTTP and MCP share one application service; neither transport constructs storage.
pub struct BackendService {
    repository: Arc<dyn ResourceStore>,
}
impl BackendService {
    pub fn new(repository: Arc<dyn ResourceStore>) -> Self {
        Self { repository }
    }
    pub async fn execute(&self, command: Command) -> Result<Outcome> {
        super::execute(self.repository.as_ref(), command).await
    }
    pub async fn execute_compound(&self, name: &str, input: Value) -> Result<Value> {
        super::composite::execute(self.repository.as_ref(), name, input).await
    }
}
