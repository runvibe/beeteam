use crate::dto::backend::{Failure, Outcome, Result};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::{PgPool, Postgres, Row, Transaction};
use std::collections::BTreeMap;
use uuid::Uuid;

pub const TABLES: &[&str] = &[
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
    "events",
    "chat_references",
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
            created_at: Utc::now(),
            updated_at: Utc::now(),
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
        self.updated_at = Utc::now();
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
pub struct ResourceRepository {
    pool: PgPool,
}
pub struct UnitOfWork {
    pub tx: Transaction<'static, Postgres>,
    pub records: Records,
    original: Records,
}
impl ResourceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    pub async fn begin(&self) -> Result<UnitOfWork> {
        let mut tx = self.pool.begin().await?;
        // Personal local service: serialize mutations and coherent reads using one DB lock.
        // No in-process mutex: independent HTTP/MCP instances participate in the same lock.
        sqlx::query("SELECT pg_advisory_xact_lock(1884347301)")
            .execute(&mut *tx)
            .await?;
        let mut records = Records::default();
        for &table in TABLES {
            // Identifiers only come from TABLES, never from requests. Values are bound below.
            let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
                "SELECT id,data,version,created_at,updated_at,archived_at,deleted_at FROM {table}"
            )))
            .fetch_all(&mut *tx)
            .await?;
            for row in rows {
                records.insert(Record {
                    table,
                    id: row.get("id"),
                    data: row.get("data"),
                    version: row.get("version"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                    archived_at: row.get("archived_at"),
                    deleted_at: row.get("deleted_at"),
                });
            }
        }
        Ok(UnitOfWork {
            tx,
            original: records.clone(),
            records,
        })
    }
}
impl UnitOfWork {
    pub async fn replay(
        &mut self,
        actor: &str,
        operation: &str,
        key: Uuid,
        hash: &str,
    ) -> Result<Option<Outcome>> {
        sqlx::query("UPDATE request_replays SET deleted_at=now() WHERE deleted_at IS NULL AND expires_at<=now()").execute(&mut *self.tx).await?;
        let row=sqlx::query("SELECT request_hash,response FROM request_replays WHERE actor_key=$1 AND operation=$2 AND request_key=$3 AND deleted_at IS NULL")
            .bind(actor).bind(operation).bind(key).fetch_optional(&mut *self.tx).await?;
        if let Some(row) = row {
            if row.get::<String, _>("request_hash") != hash {
                return Err(Failure::new(
                    "idempotency_conflict",
                    "Key was used for different content",
                ));
            }
            return Ok(Some(serde_json::from_value(row.get("response")).map_err(
                |_| Failure::new("internal_error", "Invalid replay record"),
            )?));
        }
        Ok(None)
    }
    pub async fn save_replay(
        &mut self,
        actor: &str,
        operation: &str,
        key: Uuid,
        hash: &str,
        result: &Outcome,
    ) -> Result<()> {
        sqlx::query("INSERT INTO request_replays(actor_key,operation,request_key,request_hash,response) VALUES($1,$2,$3,$4,$5)").bind(actor).bind(operation).bind(key).bind(hash).bind(json!(result)).execute(&mut *self.tx).await?;
        Ok(())
    }
    pub async fn put_file(&mut self, bytes: &[u8]) -> Result<Uuid> {
        let id = Uuid::now_v7();
        sqlx::query("INSERT INTO file_contents(id,content) VALUES($1,$2)")
            .bind(id)
            .bind(bytes)
            .execute(&mut *self.tx)
            .await?;
        Ok(id)
    }
    pub async fn file(&mut self, id: Uuid) -> Result<Vec<u8>> {
        sqlx::query_scalar("SELECT content FROM file_contents WHERE id=$1 AND deleted_at IS NULL")
            .bind(id)
            .fetch_optional(&mut *self.tx)
            .await?
            .ok_or_else(Failure::missing)
    }
    pub async fn delete_file(&mut self, id: Uuid) -> Result<()> {
        sqlx::query("UPDATE file_contents SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&mut *self.tx)
            .await?;
        Ok(())
    }
    pub async fn sequence(&mut self) -> Result<i64> {
        Ok(
            sqlx::query_scalar("SELECT nextval('beeteam_event_sequence')")
                .fetch_one(&mut *self.tx)
                .await?,
        )
    }
    pub async fn commit(mut self) -> Result<()> {
        // Release old unique role assignments inside the transaction before applying swaps.
        // Historical rows stay present; readers cannot observe this intermediate state.
        for r in self
            .records
            .rows
            .values()
            .filter(|r| matches!(r.table, "teams" | "memberships" | "images" | "statuses"))
        {
            if self
                .original
                .rows
                .get(&(r.table, r.id))
                .is_some_and(|old| old != r)
            {
                sqlx::query(sqlx::AssertSqlSafe(format!(
                    "UPDATE {} SET deleted_at=now() WHERE id=$1",
                    r.table
                )))
                .bind(r.id)
                .execute(&mut *self.tx)
                .await?;
            }
        }
        // Write tombstones first, then live rows; all foreign key targets precede dependents.
        for deleted in [true, false] {
            for &table in TABLES {
                for r in self
                    .records
                    .rows
                    .values()
                    .filter(|r| r.table == table && r.deleted_at.is_some() == deleted)
                {
                    if self.original.rows.get(&(table, r.id)) == Some(r) {
                        continue;
                    }
                    sqlx::query(sqlx::AssertSqlSafe(format!("INSERT INTO {table}(id,data,version,created_at,updated_at,archived_at,deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at,archived_at=EXCLUDED.archived_at,deleted_at=EXCLUDED.deleted_at")))
                .bind(r.id).bind(&r.data).bind(r.version).bind(r.created_at).bind(r.updated_at).bind(r.archived_at).bind(r.deleted_at).execute(&mut *self.tx).await?;
                }
            }
        }
        self.tx.commit().await?;
        Ok(())
    }
}
