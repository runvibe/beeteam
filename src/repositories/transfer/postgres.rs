use super::{
    archive::{groups, ArchiveStore, CHUNK},
    contracts::{Destination, TransferDatabase, TransferFuture},
};
use crate::dto::data_transfer::{Manifest, TimestampPolicy};
use anyhow::ensure;
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::{io::Write, sync::Arc, time::Instant};
use uuid::Uuid;
pub struct TransferRepository {
    pool: PgPool,
}
impl TransferRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}
impl TransferDatabase for TransferRepository {
    fn destination(&self) -> TransferFuture<'_, Destination> {
        Box::pin(async move {
            sqlx::query("INSERT INTO beeteam_installation(singleton,id) VALUES(true,$1) ON CONFLICT DO NOTHING").bind(Uuid::now_v7()).execute(&self.pool).await?;
            let id: Uuid = sqlx::query_scalar("SELECT id FROM beeteam_installation")
                .fetch_one(&self.pool)
                .await?;
            let mut empty = true;
            for table in groups().into_iter().chain(["authors", "posts"]) {
                let n: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(super::seed::count(
                    table,
                    super::seed::Dialect::Postgres,
                )))
                .fetch_one(&self.pool)
                .await?;
                empty &= n == 0;
            }
            Ok(Destination {
                id,
                driver: "postgres".into(),
                empty,
            })
        })
    }
    fn committed(&self, id: Uuid) -> TransferFuture<'_, bool> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await?;
            let settled: bool = sqlx::query_scalar("SELECT pg_try_advisory_xact_lock(1884347301)")
                .fetch_one(&mut *tx)
                .await?;
            ensure!(settled, "restore_outcome_pending");
            Ok(sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM beeteam_restore_markers WHERE job_id=$1)",
            )
            .bind(id)
            .fetch_one(&mut *tx)
            .await?)
        })
    }
    fn export(&self, store: Arc<ArchiveStore>, id: Uuid) -> TransferFuture<'_, Manifest> {
        Box::pin(async move {
            let started = Instant::now();
            store.create_stage(id)?;
            let mut tx = self.pool.begin().await?;
            sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                .execute(&mut *tx)
                .await?;
            for table in ["authors", "posts"] {
                let n: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
                    "SELECT count(*) FROM {table}"
                )))
                .fetch_one(&mut *tx)
                .await?;
                ensure!(n == 0, "unsupported_legacy_data");
            }
            let snapshot_at = chrono::Utc::now().to_rfc3339();
            let mut expanded = 0u64;
            let mut records = 0u64;
            for table in groups() {
                let mut offset = 0_i64;
                loop {
                    store.check(id, started)?;
                    let expr=match table {"file_contents"=>"jsonb_build_object('id',id,'createdAt',created_at,'deletedAt',deleted_at,'blob','blobs/'||id::text||'.bin','bytes',octet_length(content))","request_replays"=>"jsonb_build_object('id',id,'requestKey',request_key,'actorKey',actor_key,'operation',operation,'requestHash',request_hash,'response',response,'createdAt',created_at,'expiresAt',expires_at,'deletedAt',deleted_at)",_=>"jsonb_build_object('id',id,'data',data,'version',version,'createdAt',created_at,'updatedAt',updated_at,'archivedAt',archived_at,'deletedAt',deleted_at)"};
                    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
                        "SELECT {expr} AS value FROM {table} ORDER BY id LIMIT 32 OFFSET $1"
                    )))
                    .bind(offset)
                    .fetch_all(&mut *tx)
                    .await?;
                    if rows.is_empty() {
                        break;
                    }
                    offset += rows.len() as i64;
                    for row in rows {
                        let value: Value = row.get("value");
                        expanded = expanded
                            .checked_add(
                                serde_json::to_vec(&value)?.len() as u64
                                    + 1
                                    + value["bytes"]
                                        .as_u64()
                                        .filter(|_| table == "file_contents")
                                        .unwrap_or(0),
                            )
                            .ok_or_else(|| anyhow::anyhow!("expanded_limit"))?;
                        ensure!(expanded <= store.limits.expanded, "expanded_limit");
                        records += 1;
                        store.append(id, &format!("records/{table}.jsonl"), &value)?;
                        if table == "file_contents" {
                            let blob = Uuid::parse_str(value["id"].as_str().unwrap())?;
                            store.ensure_space(value["bytes"].as_u64().unwrap())?;
                            let mut output = store.blob_writer(id, blob)?;
                            let size = value["bytes"].as_u64().unwrap();
                            let mut pos = 0_u64;
                            while pos < size {
                                store.check(id, started)?;
                                let bytes:Vec<u8>=sqlx::query_scalar("SELECT substring(content from $2::integer for $3::integer) FROM file_contents WHERE id=$1").bind(blob).bind((pos+1) as i64).bind(CHUNK as i64).fetch_one(&mut *tx).await?;
                                ensure!(!bytes.is_empty(), "truncated_blob");
                                output.write_all(&bytes)?;
                                pos += bytes.len() as u64;
                            }
                        }
                    }
                    store.progress(id, table, records)?;
                }
            }
            let floor:i64=sqlx::query_scalar("SELECT GREATEST((SELECT last_value FROM beeteam_event_sequence),COALESCE((SELECT max(sequence) FROM events),0))").fetch_one(&mut *tx).await?;
            tx.commit().await?;
            store.check(id, started)?;
            store.seal_at(id, "postgres", floor, snapshot_at)
        })
    }
    fn restore(
        &self,
        store: Arc<ArchiveStore>,
        id: Uuid,
        manifest: Manifest,
        expected: Uuid,
        policy: TimestampPolicy,
        hash: String,
    ) -> TransferFuture<'_, ()> {
        Box::pin(super::postgres_restore::restore(
            &self.pool, store, id, manifest, expected, policy, hash,
        ))
    }
}
