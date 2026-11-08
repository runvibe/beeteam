//! Persistence and integration-facing structs live here.

pub mod database;
pub mod resources;

pub mod changes;

pub mod contracts;
pub mod codex_session;
pub mod integrated_provider;
pub mod codex_integrated;
pub mod codex_mcp_scope;
pub mod session_dispatch_lease;
mod errors;
pub mod records;
mod task_order;

pub mod query;
mod reads;
mod leader_chat_reads;

pub mod sqlite;

pub mod frontend;
pub mod transfer;

mod participants;
mod agent_activity;

mod overview;
mod usage;

mod tracking;

pub mod project_discovery;
pub mod local_git;
pub mod local_projects;
