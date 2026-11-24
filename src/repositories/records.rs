use crate::dto::backend::{Failure, Result};
use chrono::{DateTime, Timelike, Utc};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use uuid::Uuid;

pub const TABLES: &[&str] = &[
    "managed_conversations",
    "managed_requests",
    "managed_messages",
    "managed_approvals",
    "managed_events",
    "agents",
    "teams",
    "boards",
    "statuses",
    "tasks",
    "plans",
    "plan_revisions",
    "comments",
    "attachments",
    "execution_summaries",
    "task_executions",
    "task_execution_intervals",
    "task_execution_interval_counters",
    "task_execution_tracking_events",
    "task_execution_interval_revisions",
    "events",
    "chat_references",
    "agent_session_bindings",
    "session_deliveries",
    "leader_session_operations",
    "leader_chats",
    "leader_chat_turns",
    "leader_chat_messages",
    "leader_chat_approvals",
    "leader_chat_events",
    "leader_chat_tools",
    "images",
    "memberships",
    "board_events",
];
#[derive(Clone, Debug, PartialEq)]
pub struct Record {
    pub table: &'static str,
    pub id: Uuid,
    pub data: Value,
    pub version: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub archived_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
}
impl Record {
    pub fn new(table: &'static str, data: Value) -> Self {
        Self {
            table,
            id: Uuid::now_v7(),
            data,
            version: 1,
            created_at: metadata_time(Utc::now()),
            updated_at: metadata_time(Utc::now()),
            archived_at: None,
            deleted_at: None,
        }
    }
    pub fn value(&self) -> Value {
        let mut v = self.data.clone();
        v["id"] = json!(self.id);
        v["version"] = json!(self.version);
        v["createdAt"] = json!(self.created_at);
        v["updatedAt"] = json!(self.updated_at);
        v["archivedAt"] = json!(self.archived_at);
        v["deletedAt"] = json!(self.deleted_at);
        v
    }
    pub fn touch(&mut self) {
        self.version += 1;
        self.updated_at = metadata_time(Utc::now());
    }
    pub fn reference(&self, key: &str) -> Option<Uuid> {
        self.data[key]
            .as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
    }
}
#[derive(Clone, Default)]
pub struct Records {
    pub rows: BTreeMap<(&'static str, Uuid), Record>,
}
impl Records {
    pub fn get(&self, table: &str, id: Uuid) -> Result<&Record> {
        self.rows
            .iter()
            .find(|((t, i), r)| *t == table && *i == id && r.deleted_at.is_none())
            .map(|(_, r)| r)
            .ok_or_else(Failure::missing)
    }
    pub fn get_mut(&mut self, table: &'static str, id: Uuid) -> Result<&mut Record> {
        self.rows
            .get_mut(&(table, id))
            .filter(|r| r.deleted_at.is_none())
            .ok_or_else(Failure::missing)
    }
    pub fn list(&self, table: &str) -> Vec<&Record> {
        self.rows
            .values()
            .filter(|r| r.table == table && r.deleted_at.is_none())
            .collect()
    }
    pub fn insert(&mut self, r: Record) -> Uuid {
        let id = r.id;
        self.rows.insert((r.table, id), r);
        id
    }
}

pub struct Selection {
    pub items: Vec<Value>,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub records: Records,
    pub table: &'static str,
}

// Newly generated metadata uses the precision shared by PostgreSQL and SQLite.
// Do not apply this to loaded records, replay snapshots or portable transfer data.
fn metadata_time(now: DateTime<Utc>) -> DateTime<Utc> {
    now.with_nanosecond(now.nanosecond() / 1_000 * 1_000)
        .expect("microsecond precision is a valid nanosecond value")
}

#[cfg(test)]
mod metadata_clock_tests {
    use super::*;

    #[test]
    fn new_metadata_uses_microseconds_without_rewriting_existing_values() {
        let original: DateTime<Utc> = "2026-11-08T16:00:00.768166800Z".parse().unwrap();
        assert_eq!(
            metadata_time(original).to_rfc3339(),
            "2026-11-08T16:00:00.768166+00:00"
        );
        let mut record = Record::new("comments", json!({"authoredTimestamp": original}));
        assert_eq!(record.created_at.nanosecond() % 1_000, 0);
        assert_eq!(record.updated_at.nanosecond() % 1_000, 0);
        record.created_at = original;
        record.updated_at = original;
        let snapshot = record.value();
        assert_eq!(snapshot["createdAt"], json!(original));
        assert_eq!(snapshot["updatedAt"], json!(original));
        record.touch();
        assert_eq!(record.created_at, original);
        assert_eq!(record.updated_at.nanosecond() % 1_000, 0);
        assert_eq!(record.data["authoredTimestamp"], json!(original));
        assert_eq!(snapshot["updatedAt"], json!(original));
    }
}
