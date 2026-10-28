use super::{
    archive::{groups, ArchiveStore, CHUNK},
    restore::*,
};
use crate::dto::data_transfer::{Manifest, TimestampPolicy};
use anyhow::{ensure, Context, Result};
use sqlx::SqlitePool;
use std::{collections::BTreeSet, io::Read, sync::Arc, time::Instant};
use uuid::Uuid;

pub async fn restore(
    pool: &SqlitePool,
    store: Arc<ArchiveStore>,
    id: Uuid,
    manifest: Manifest,
    expected: Uuid,
    _policy: TimestampPolicy,
    hash: String,
) -> Result<()> {
    let started = Instant::now();
    store.start_clock(id)?;
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let identity: String = sqlx::query_scalar("SELECT id FROM beeteam_installation")
        .fetch_one(&mut *tx)
        .await?;
    ensure!(identity == expected.to_string(), "destination_changed");
    let previous: Option<String> =
        sqlx::query_scalar("SELECT archive_sha256 FROM beeteam_restore_markers WHERE job_id=$1")
            .bind(id.to_string())
            .fetch_optional(&mut *tx)
            .await?;
    if let Some(previous) = previous {
        ensure!(previous == hash, "idempotency_conflict");
        return Ok(());
    }
    ensure!(store.digest(id)? == hash, "archive_changed");
    ensure!(store.validate_archive(id)? == manifest, "manifest_changed");
    for table in groups() {
        let count: i64 =
            sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT count(*) FROM {table}")))
                .fetch_one(&mut *tx)
                .await?;
        ensure!(count == 0, "destination_not_empty");
    }
    for row in store.row_iter(id, "file_contents")? {
        store.check(id, started)?;
        let row = row?;
        let blob = super::restore::id(&row)?;
        sqlx::query(
            "INSERT INTO file_contents(id,content,created_at,deleted_at) VALUES($1,$2,$3,$4)",
        )
        .bind(blob.to_string())
        .bind(Vec::<u8>::new())
        .bind(row["createdAt"].as_str())
        .bind(row["deletedAt"].as_str())
        .execute(&mut *tx)
        .await?;
        let mut input = store.blob_reader(id, blob)?;
        let mut buffer = vec![0; CHUNK];
        let mut bytes = 0u64;
        loop {
            store.check(id, started)?;
            let n = input.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            sqlx::query("UPDATE file_contents SET content=CAST(content || $2 AS BLOB) WHERE id=$1")
                .bind(blob.to_string())
                .bind(&buffer[..n])
                .execute(&mut *tx)
                .await?;
            bytes += n as u64;
        }
        ensure!(row["bytes"].as_u64() == Some(bytes), "blob_size_mismatch");
    }
    for table in crate::repositories::records::TABLES {
        let mut inserted = BTreeSet::new();
        loop {
            let mut pending = false;
            let mut seen = BTreeSet::new();
            let before = inserted.len();
            for row in store.row_iter(id, table)? {
                store.check(id, started)?;
                let row = row?;
                let row_id = super::restore::id(&row)?;
                ensure!(seen.insert(row_id), "duplicate_id");
                if inserted.contains(&row_id) {
                    continue;
                }
                if *table == "tasks" {
                    if let Some(parent) = row["data"]["parentId"].as_str() {
                        if !inserted.contains(&Uuid::parse_str(parent)?) {
                            pending = true;
                            continue;
                        }
                    }
                }
                sqlx::query(sqlx::AssertSqlSafe(format!("INSERT INTO {table}(id,data,version,created_at,updated_at,archived_at,deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7)")))
                    .bind(row_id.to_string()).bind(row["data"].to_string()).bind(row["version"].as_i64().context("invalid_version")?)
                    .bind(row["createdAt"].as_str()).bind(row["updatedAt"].as_str()).bind(row["archivedAt"].as_str()).bind(row["deletedAt"].as_str()).execute(&mut *tx).await?;
                ensure!(inserted.insert(row_id), "duplicate_id");
            }
            store.progress(id, table, inserted.len() as u64)?;
            if !pending {
                break;
            }
            ensure!(inserted.len() > before, "task_cycle_or_missing_parent");
        }
    }
    for row in store.row_iter(id, "request_replays")? {
        store.check(id, started)?;
        let row = row?;
        let row_id = super::restore::id(&row)?;
        sqlx::query("INSERT INTO request_replays(id,request_key,actor_key,operation,request_hash,response,created_at,expires_at,deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)")
            .bind(row_id.to_string()).bind(text(&row,"requestKey")?).bind(text(&row,"actorKey")?).bind(text(&row,"operation")?).bind(text(&row,"requestHash")?).bind(row["response"].to_string())
            .bind(row["createdAt"].as_str()).bind(row["expiresAt"].as_str()).bind(row["deletedAt"].as_str()).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE beeteam_clock SET sequence=max(sequence,$1),changes=changes+1 WHERE id=1")
        .bind(manifest.sequence_floor)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO beeteam_restore_markers(job_id,archive_sha256,committed_at) VALUES($1,$2,$3)",
    )
    .bind(id.to_string())
    .bind(hash)
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(&mut *tx)
    .await?;
    store.check(id, started)?;
    tx.commit().await?;
    Ok(())
}
