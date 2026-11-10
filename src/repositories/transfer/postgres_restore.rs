use super::{
    archive::{groups, ArchiveStore, CHUNK},
    restore::*,
};
use crate::dto::data_transfer::{Manifest, TimestampPolicy};
use anyhow::{ensure, Context, Result};
use sqlx::PgPool;
use std::{collections::BTreeSet, io::Read, sync::Arc, time::Instant};
use uuid::Uuid;

pub async fn restore(
    pool: &PgPool,
    store: Arc<ArchiveStore>,
    id: Uuid,
    manifest: Manifest,
    expected: Uuid,
    policy: TimestampPolicy,
    hash: String,
) -> Result<()> {
    let started = Instant::now();
    store.start_clock(id)?;
    let mut tx = pool.begin().await?;
    loop {
        store.check(id, started)?;
        let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_xact_lock(1884347301)")
            .fetch_one(&mut *tx)
            .await?;
        if locked {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    let identity: uuid::Uuid = sqlx::query_scalar("SELECT id FROM beeteam_installation")
        .fetch_one(&mut *tx)
        .await?;
    ensure!(identity == expected, "destination_changed");
    let previous: Option<String> =
        sqlx::query_scalar("SELECT archive_sha256 FROM beeteam_restore_markers WHERE job_id=$1")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?;
    if let Some(previous) = previous {
        ensure!(previous == hash, "idempotency_conflict");
        return Ok(());
    }
    ensure!(store.digest(id)? == hash, "archive_changed");
    ensure!(store.validate_archive(id)? == manifest, "manifest_changed");
    for table in groups().into_iter().chain(["authors", "posts"]) {
        let count: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(super::seed::count(
            table,
            super::seed::Dialect::Postgres,
        )))
        .fetch_one(&mut *tx)
        .await?;
        ensure!(count == 0, "destination_not_empty");
    }
    for statement in super::seed::deletions(super::seed::Dialect::Postgres) {
        sqlx::query(sqlx::AssertSqlSafe(statement))
            .execute(&mut *tx)
            .await?;
    }
    for row in store.row_iter(id, "file_contents")? {
        store.check(id, started)?;
        let row = row?;
        let blob = super::restore::id(&row)?;
        sqlx::query(
            "INSERT INTO file_contents(id,content,created_at,deleted_at) VALUES($1,$2,$3,$4)",
        )
        .bind(blob)
        .bind(Vec::<u8>::new())
        .bind(date(&row, "createdAt", &policy)?)
        .bind(date(&row, "deletedAt", &policy)?)
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
            sqlx::query("UPDATE file_contents SET content=content || $2 WHERE id=$1")
                .bind(blob)
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
                    .bind(row_id).bind(row["data"].clone()).bind(row["version"].as_i64().context("invalid_version")?)
                    .bind(date(&row, "createdAt", &policy)?).bind(date(&row, "updatedAt", &policy)?).bind(date(&row, "archivedAt", &policy)?).bind(date(&row, "deletedAt", &policy)?).execute(&mut *tx).await?;
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
            .bind(row_id).bind(Uuid::parse_str(text(&row,"requestKey")?)?).bind(text(&row,"actorKey")?).bind(text(&row,"operation")?).bind(text(&row,"requestHash")?).bind(row["response"].clone())
            .bind(date(&row, "createdAt", &policy)?).bind(date(&row, "expiresAt", &policy)?).bind(date(&row, "deletedAt", &policy)?).execute(&mut *tx).await?;
    }
    sqlx::query("SELECT setval('beeteam_event_sequence', GREATEST((SELECT last_value FROM beeteam_event_sequence),$1,1),true)").bind(manifest.sequence_floor).execute(&mut *tx).await?;
    sqlx::query("SELECT pg_notify('beeteam_changes','')")
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO beeteam_restore_markers(job_id,archive_sha256,committed_at) VALUES($1,$2,$3)",
    )
    .bind(id)
    .bind(hash)
    .bind(chrono::Utc::now())
    .execute(&mut *tx)
    .await?;
    store.check(id, started)?;
    tx.commit().await?;
    Ok(())
}
