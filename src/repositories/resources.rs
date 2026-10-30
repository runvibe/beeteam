pub use super::contracts::UnitOfWork;
use super::contracts::{RepositoryFuture, ResourceStore, TransactionStore};
pub use super::records::{Record, Records, TABLES};
use crate::dto::backend::{Command, Failure, Outcome, Result};
use serde_json::json;
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

pub struct ResourceRepository {
    pool: PgPool,
}
struct PostgresWork {
    tx: Transaction<'static, Postgres>,
    original: Records,
    read_only: bool,
}
impl ResourceRepository {
    pub fn new(pool: PgPool) -> Self {
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
        Ok((row.get("id"), row.get("slug")))
    }
    pub async fn begin(&self) -> Result<UnitOfWork> {
        self.open(None).await
    }
    async fn open(&self, command: Option<&Command>) -> Result<UnitOfWork> {
        let read_only = command.is_some();
        let mut tx = self.pool.begin().await?;
        // Serialize mutations only. Reads use a consistent MVCC snapshot.
        // No in-process mutex: independent HTTP/MCP instances participate in the same lock.
        if read_only {
            sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query("SELECT pg_advisory_xact_lock(1884347301)")
                .execute(&mut *tx)
                .await?;
        }
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
        }
        let work = PostgresWork {
            tx,
            original: records.clone(),
            read_only,
        };
        Ok(UnitOfWork::new(records, Box::new(work)))
    }
}
impl PostgresWork {
    pub async fn allocate_slug(&mut self, table: &str, label: &str) -> Result<String> {
        Ok(sqlx::query_scalar("SELECT beeteam_allocate_slug($1,$2)")
            .bind(table)
            .bind(label)
            .fetch_one(&mut *self.tx)
            .await?)
    }

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
                for r in records
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
        if records.rows != self.original.rows {
            super::changes::notify(&mut self.tx).await?;
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
impl TransactionStore for PostgresWork {
    fn select<'a>(
        &'a mut self,
        command: &'a Command,
    ) -> RepositoryFuture<'a, super::records::Selection> {
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
        Box::pin(PostgresWork::allocate_slug(self, table, label))
    }
    fn replay<'a>(
        &'a mut self,
        actor: &'a str,
        operation: &'a str,
        key: Uuid,
        hash: &'a str,
    ) -> RepositoryFuture<'a, Option<Outcome>> {
        Box::pin(PostgresWork::replay(self, actor, operation, key, hash))
    }
    fn save_replay<'a>(
        &'a mut self,
        actor: &'a str,
        operation: &'a str,
        key: Uuid,
        hash: &'a str,
        result: &'a Outcome,
    ) -> RepositoryFuture<'a, ()> {
        Box::pin(PostgresWork::save_replay(
            self, actor, operation, key, hash, result,
        ))
    }
    fn put_file<'a>(&'a mut self, bytes: &'a [u8]) -> RepositoryFuture<'a, Uuid> {
        Box::pin(PostgresWork::put_file(self, bytes))
    }
    fn file(&mut self, id: Uuid) -> RepositoryFuture<'_, Vec<u8>> {
        Box::pin(PostgresWork::file(self, id))
    }
    fn delete_file(&mut self, id: Uuid) -> RepositoryFuture<'_, ()> {
        Box::pin(PostgresWork::delete_file(self, id))
    }
    fn sequence(&mut self) -> RepositoryFuture<'_, i64> {
        Box::pin(PostgresWork::sequence(self))
    }
    fn commit(self: Box<Self>, records: Records) -> RepositoryFuture<'static, ()> {
        Box::pin(PostgresWork::commit(*self, records))
    }
}
