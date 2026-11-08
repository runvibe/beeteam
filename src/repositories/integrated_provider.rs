//! Provider protocol boundary for sessions owned by Bee Team.
use crate::dto::session_delivery::{SessionDestination, SessionFailure};
use serde_json::Value;
use std::{future::Future, pin::Pin};
use tokio::sync::mpsc;
use uuid::Uuid;
pub type ProviderFuture<'a, T> =
    Pin<Box<dyn Future<Output = Result<T, SessionFailure>> + Send + 'a>>;
#[derive(Debug)]
pub enum IntegratedEvent {
    Accepted(String),
    Text(String),
    Approval {
        approval_id: Uuid,
        kind: String,
        title: String,
        description: String,
        command: Option<String>,
        host: Option<String>,
        paths: Vec<String>,
    },
    Completed,
    Cancelled,
    Tool {
        name: String,
        summary: String,
    },
}
#[derive(Debug)]
pub enum Control {
    Cancel,
    Decision { approval_id: Uuid, accept: bool },
}
pub fn validate_root(root: &str) -> Result<(), SessionFailure> {
    if !std::path::Path::new(root).is_absolute() || !std::path::Path::new(root).is_dir() {
        return Err(SessionFailure::new(
            "invalid_request",
            "Project folder must exist and be absolute",
            false,
        ));
    }
    Ok(())
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReconciledStatus {
    Completed,
    Cancelled,
    Failed,
    Running,
    Unknown,
}
#[derive(Debug, Clone)]
pub struct ReconciledTurn {
    pub status: ReconciledStatus,
    pub text: Option<String>,
}
pub trait IntegratedProvider: Send + Sync {
    fn reconcile<'a>(
        &'a self,
        _target: &'a SessionDestination,
        _provider_turn_id: &'a str,
        _profile: &'a Value,
    ) -> ProviderFuture<'a, ReconciledTurn> {
        Box::pin(async {
            Err(SessionFailure::new(
                "unsupported_capability",
                "Provider cannot reconcile persisted turns",
                false,
            ))
        })
    }
    fn validate(&self, root: &str, _profile: &Value) -> Result<(), SessionFailure> {
        validate_root(root)
    }
    fn create<'a>(&'a self, root: &'a str, profile: &'a Value) -> ProviderFuture<'a, String>;
    fn run<'a>(
        &'a self,
        target: &'a SessionDestination,
        text: &'a str,
        profile: &'a Value,
        events: mpsc::Sender<IntegratedEvent>,
        controls: mpsc::Receiver<Control>,
    ) -> ProviderFuture<'a, ()>;
    fn inspect<'a>(
        &'a self,
        target: &'a SessionDestination,
        profile: &'a Value,
    ) -> ProviderFuture<'a, Value>;
    fn tools(&self) -> Value {
        serde_json::json!({"webSearch":"live","networkAccess":true,"skills":[],"mcpServers":[]})
    }
}
