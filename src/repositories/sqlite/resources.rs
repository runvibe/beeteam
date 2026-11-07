pub use super::super::contracts::UnitOfWork;
use super::super::contracts::{RepositoryFuture, ResourceStore, TransactionStore};
pub use super::super::records::{Records, TABLES};
use crate::dto::backend::{Command, Failure, Outcome, Result};
use chrono::Utc;
use serde_json::json;
use sqlx::{Row, Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

pub struct ResourceRepository {
    pool: SqlitePool,
}
struct SqliteWork {
    tx: Transaction<'static, Sqlite>,
    original: Records,
    read_only: bool,
}
impl ResourceRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
    pub async fn resolve_slug(&self, table: &'static str, slug: &str) -> Result<(Uuid, String)> {
        if !matches!(table, "agents" | "teams" | "tasks") {
            return Err(Failure::missing());
        }
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT id,slug FROM {table} WHERE slug=$1 AND deleted_at IS NULL"
        )))
        .bind(slug)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(Failure::missing)?;
        Ok((
            Uuid::parse_str(&row.get::<String, _>("id"))
                .map_err(|_| Failure::new("internal_error", "Invalid stored UUID"))?,
            row.get("slug"),
        ))
    }
    pub async fn begin(&self) -> Result<UnitOfWork> {
        self.open(None).await
    }
    async fn open(&self, command: Option<&Command>) -> Result<UnitOfWork> {
        let read_only = command.is_some();
        let mut tx = if read_only {
            self.pool.begin().await?
        } else {
            self.pool.begin_with("BEGIN IMMEDIATE").await?
        };
        // SQLite serializes writers across processes before taking a data snapshot.
        // Deferred transactions keep WAL readers independent from the active writer.
        let mut records = Records::default();
        if let Some(command) = command {
            records = super::reads::context(&mut tx, command).await?;
        } else {
            for &table in TABLES {
                // Identifiers only come from TABLES, never from requests. Values are bound below.
                let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
                "SELECT id,data,version,created_at,updated_at,archived_at,deleted_at FROM {table}"
            )))
                .fetch_all(&mut *tx)
                .await?;
                for row in rows {
                    records.insert(super::reads::record(table, &row));
                }
            }
        }
        let work = SqliteWork {
            tx,
            original: records.clone(),
            read_only,
        };
        Ok(UnitOfWork::new(records, Box::new(work)))
    }
}
impl SqliteWork {
    fn writable(&self) -> Result<()> {
        if self.read_only {
            Err(Failure::invalid("Read-only unit cannot write"))
        } else {
            Ok(())
        }
    }
    pub async fn allocate_slug(&mut self, table: &str, label: &str) -> Result<String> {
        self.writable()?;
        if !matches!(table, "agents" | "teams" | "tasks") {
            return Err(Failure::invalid("Unsupported slug entity"));
        }
        let base = super::slugs::base(label, table.trim_end_matches('s'));
        let mut candidate = base.clone();
        let mut number = 1_u64;
        loop {
            let taken: bool = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
                "SELECT EXISTS(SELECT 1 FROM {table} WHERE slug=$1)"
            )))
            .bind(&candidate)
            .fetch_one(&mut *self.tx)
            .await?;
            if !taken {
                return Ok(candidate);
            }
            number += 1;
            let suffix = format!("-{number}");
            candidate = format!(
                "{}{}",
                base[..80_usize.saturating_sub(suffix.len()).min(base.len())].trim_end_matches('-'),
                suffix
            );
        }
    }

    pub async fn replay(
        &mut self,
        actor: &str,
        operation: &str,
        key: Uuid,
        hash: &str,
    ) -> Result<Option<Outcome>> {
        self.writable()?;
        sqlx::query("UPDATE request_replays SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE deleted_at IS NULL AND julianday(expires_at)<=julianday('now')").execute(&mut *self.tx).await?;
        let row=sqlx::query("SELECT request_hash,response FROM request_replays WHERE actor_key=$1 AND operation=$2 AND request_key=$3 AND deleted_at IS NULL")
            .bind(actor).bind(operation).bind(key.to_string()).fetch_optional(&mut *self.tx).await?;
        if let Some(row) = row {
            if row.get::<String, _>("request_hash") != hash {
                return Err(Failure::new(
                    "idempotency_conflict",
                    "Key was used for different content",
                ));
            }
            return Ok(Some(
                serde_json::from_str(&row.get::<String, _>("response"))
                    .map_err(|_| Failure::new("internal_error", "Invalid replay record"))?,
            ));
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
        self.writable()?;
        sqlx::query("INSERT INTO request_replays(actor_key,operation,request_key,request_hash,response,id,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)").bind(actor).bind(operation).bind(key.to_string()).bind(hash).bind(json!(result).to_string()).bind(Uuid::now_v7().to_string()).bind(Utc::now()).bind(Utc::now()+chrono::Duration::hours(24)).execute(&mut *self.tx).await?;
        Ok(())
    }
    pub async fn put_file(&mut self, bytes: &[u8]) -> Result<Uuid> {
        self.writable()?;
        let id = Uuid::now_v7();
        sqlx::query("INSERT INTO file_contents(id,content,created_at) VALUES($1,$2,$3)")
            .bind(id.to_string())
            .bind(bytes)
            .bind(Utc::now())
            .execute(&mut *self.tx)
            .await?;
        Ok(id)
    }
    pub async fn file(&mut self, id: Uuid) -> Result<Vec<u8>> {
        sqlx::query_scalar("SELECT content FROM file_contents WHERE id=$1 AND deleted_at IS NULL")
            .bind(id.to_string())
            .fetch_optional(&mut *self.tx)
            .await?
            .ok_or_else(Failure::missing)
    }
    pub async fn delete_file(&mut self, id: Uuid) -> Result<()> {
        self.writable()?;
        sqlx::query("UPDATE file_contents SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$1 AND deleted_at IS NULL")
            .bind(id.to_string())
            .execute(&mut *self.tx)
            .await?;
        Ok(())
    }
    pub async fn sequence(&mut self) -> Result<i64> {
        self.writable()?;
        Ok(sqlx::query_scalar(
            "UPDATE beeteam_clock SET sequence=sequence+1 WHERE id=1 RETURNING sequence",
        )
        .fetch_one(&mut *self.tx)
        .await?)
    }
    pub async fn commit(mut self, records: Records) -> Result<()> {
        if self.read_only {
            if records.rows != self.original.rows {
                return Err(Failure::invalid("Read-only unit cannot write"));
            }
            self.tx.commit().await?;
            return Ok(());
        }
        // Release old unique role assignments inside the transaction before applying swaps.
        // Historical rows stay present; readers cannot observe this intermediate state.
        for r in records
            .rows
            .values()
            .filter(|r| matches!(r.table, "teams" | "memberships" | "images" | "statuses" | "agent_session_bindings"))
        {
            if self
                .original
                .rows
                .get(&(r.table, r.id))
                .is_some_and(|old| old != r)
            {
                sqlx::query(sqlx::AssertSqlSafe(format!(
                    "UPDATE {} SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=$1",
                    r.table
                )))
                .bind(r.id.to_string())
                .execute(&mut *self.tx)
                .await?;
            }
        }
        let ordered_tasks = super::super::task_order::tasks(&records)?;
        // Write tombstones first, then live rows; all foreign key targets precede dependents.
        for deleted in [true, false] {
            for &table in TABLES {
                let rows: Vec<_> = if table == "tasks" {
                    ordered_tasks.iter().copied().filter(|r| r.deleted_at.is_some() == deleted).collect()
                } else {
                    records.rows.values().filter(|r| r.table == table && r.deleted_at.is_some() == deleted).collect()
                };
                for r in rows {
                    if self.original.rows.get(&(table, r.id)) == Some(r) {
                        continue;
                    }
                    sqlx::query(sqlx::AssertSqlSafe(format!("INSERT INTO {table}(id,data,version,created_at,updated_at,archived_at,deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,version=EXCLUDED.version,updated_at=EXCLUDED.updated_at,archived_at=EXCLUDED.archived_at,deleted_at=EXCLUDED.deleted_at")))
                .bind(r.id.to_string()).bind(r.data.to_string()).bind(r.version).bind(timestamp(r.created_at)).bind(timestamp(r.updated_at)).bind(r.archived_at.map(timestamp)).bind(r.deleted_at.map(timestamp)).execute(&mut *self.tx).await?;
                }
            }
        }
        if records.rows != self.original.rows {
            sqlx::query("UPDATE beeteam_clock SET changes=changes+1 WHERE id=1")
                .execute(&mut *self.tx)
                .await?;
        }
        self.tx.commit().await?;
        Ok(())
    }
}

impl ResourceStore for ResourceRepository {
    fn resolve_slug<'a>(
        &'a self,
        table: &'static str,
        slug: &'a str,
    ) -> RepositoryFuture<'a, (Uuid, String)> {
        Box::pin(self.resolve_slug(table, slug))
    }
    fn begin(&self) -> RepositoryFuture<'_, UnitOfWork> {
        Box::pin(self.open(None))
    }
    fn read<'a>(&'a self, command: &'a Command) -> RepositoryFuture<'a, UnitOfWork> {
        Box::pin(self.open(Some(command)))
    }
}
impl TransactionStore for SqliteWork {
    fn select<'a>(
        &'a mut self,
        command: &'a Command,
    ) -> RepositoryFuture<'a, super::super::records::Selection> {
        Box::pin(async move {
            let selected = super::query::select(&mut self.tx, command).await?;
            if self.read_only {
                self.original.rows.extend(selected.records.rows.clone());
            }
            Ok(selected)
        })
    }
    fn allocate_slug<'a>(
        &'a mut self,
        table: &'a str,
        label: &'a str,
    ) -> RepositoryFuture<'a, String> {
        Box::pin(SqliteWork::allocate_slug(self, table, label))
    }
    fn replay<'a>(
        &'a mut self,
        actor: &'a str,
        operation: &'a str,
        key: Uuid,
        hash: &'a str,
    ) -> RepositoryFuture<'a, Option<Outcome>> {
        Box::pin(SqliteWork::replay(self, actor, operation, key, hash))
    }
    fn save_replay<'a>(
        &'a mut self,
        actor: &'a str,
        operation: &'a str,
        key: Uuid,
        hash: &'a str,
        result: &'a Outcome,
    ) -> RepositoryFuture<'a, ()> {
        Box::pin(SqliteWork::save_replay(
            self, actor, operation, key, hash, result,
        ))
    }
    fn put_file<'a>(&'a mut self, bytes: &'a [u8]) -> RepositoryFuture<'a, Uuid> {
        Box::pin(SqliteWork::put_file(self, bytes))
    }
    fn file(&mut self, id: Uuid) -> RepositoryFuture<'_, Vec<u8>> {
        Box::pin(SqliteWork::file(self, id))
    }
    fn delete_file(&mut self, id: Uuid) -> RepositoryFuture<'_, ()> {
        Box::pin(SqliteWork::delete_file(self, id))
    }
    fn sequence(&mut self) -> RepositoryFuture<'_, i64> {
        Box::pin(SqliteWork::sequence(self))
    }
    fn rollback(self: Box<Self>) -> RepositoryFuture<'static, ()> {
        Box::pin(async move { self.tx.rollback().await?; Ok(()) })
    }
    fn commit(self: Box<Self>, records: Records) -> RepositoryFuture<'static, ()> {
        Box::pin(SqliteWork::commit(*self, records))
    }
}

fn timestamp(value: chrono::DateTime<Utc>) -> String {
    value.to_rfc3339_opts(chrono::SecondsFormat::Nanos, true)
}
