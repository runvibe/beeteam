//! PostgreSQL read snapshots and bounded hydration. No HTTP/MCP response construction.
use super::super::records::{Record, Records};
use crate::dto::backend::{Command, Result};
use sqlx::{sqlite::SqliteRow, Row, Sqlite, Transaction};
use uuid::Uuid;

pub(crate) fn record(table: &'static str, row: &SqliteRow) -> Record {
    Record {
        table,
        id: Uuid::parse_str(row.get("id")).expect("schema-checked UUID"),
        data: row.get("data"),
        version: row.get("version"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        archived_at: row.get("archived_at"),
        deleted_at: row.get("deleted_at"),
    }
}

async fn load_ids(
    tx: &mut Transaction<'_, Sqlite>,
    records: &mut Records,
    table: &'static str,
    ids: &[Uuid],
) -> Result<()> {
    if ids.is_empty() {
        return Ok(());
    }
    // Table identifiers are internal constants, never caller-controlled.
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT * FROM {table} WHERE id  IN (SELECT value FROM json_each($1))"
    )))
    .bind(serde_json::json!(ids).to_string())
    .fetch_all(&mut **tx)
    .await?;
    for row in rows {
        records.insert(record(table, &row));
    }
    Ok(())
}

pub(super) async fn context(tx: &mut Transaction<'_, Sqlite>, c: &Command) -> Result<Records> {
    let mut records = Records::default();
    for (key, table) in [
        ("agentId", "agents"),
        ("teamId", "teams"),
        ("boardId", "boards"),
        ("taskId", "tasks"),
        ("planId", "plans"),
        ("commentId", "comments"),
        ("attachmentId", "attachments"),
        ("parentId", "tasks"),
        ("statusId", "statuses"),
        ("authorAgentId", "agents"),
        ("executorAgentId", "agents"),
        ("leaderId", "agents"),
        ("collaboratorId", "agents"),
        ("actorId", "agents"),
    ] {
        let ids: Vec<Uuid> = c
            .params
            .get(key)
            .map(String::as_str)
            .into_iter()
            .chain(c.query.get(key).and_then(|v| v.as_str()))
            .filter_map(|v| Uuid::parse_str(v).ok())
            .collect();
        load_ids(tx, &mut records, table, &ids).await?;
    }
    if let Some(id) = c.actor.as_ref().and_then(|a| a.id) {
        load_ids(tx, &mut records, "agents", &[id]).await?;
    }
    if let Some(ids) = c.q("taskIds").as_array() {
        let ids = ids
            .iter()
            .filter_map(|v| v.as_str().and_then(|s| Uuid::parse_str(s).ok()))
            .collect::<Vec<_>>();
        load_ids(tx, &mut records, "tasks", &ids).await?;
    }
    if c.operation == "getBoardView" {
        let rows = sqlx::query("SELECT * FROM statuses WHERE board_id=$1 AND deleted_at IS NULL")
            .bind(c.id("boardId")?.to_string())
            .fetch_all(&mut **tx)
            .await?;
        for row in rows {
            records.insert(record("statuses", &row));
        }
    }
    if c.operation == "downloadAgentImage" {
        let rows = sqlx::query("SELECT * FROM images WHERE agent_id=$1 AND deleted_at IS NULL")
            .bind(c.id("agentId")?.to_string())
            .fetch_all(&mut **tx)
            .await?;
        for row in rows {
            records.insert(record("images", &row));
        }
    }
    hydrate_scoped(tx, &mut records, !matches!(c.operation.as_str(),"getTaskOverview"|"getTaskUsage"|"listTaskUsageDimensions")).await?;
    Ok(records)
}

/// Related records needed by domain projections, restricted to the selected resources.
pub(super) async fn hydrate(tx: &mut Transaction<'_, Sqlite>, records: &mut Records) -> Result<()> {
    hydrate_scoped(tx, records, true).await
}
async fn hydrate_scoped(
    tx: &mut Transaction<'_, Sqlite>,
    records: &mut Records,
    include_children: bool,
) -> Result<()> {
    let task_ids: Vec<_> = records.list("tasks").iter().map(|r| r.id).collect();
    if !task_ids.is_empty() {
        let rows = sqlx::query("WITH RECURSIVE ancestors AS (SELECT id,parent_id FROM tasks WHERE id IN (SELECT value FROM json_each($1)) AND deleted_at IS NULL UNION SELECT t.id,t.parent_id FROM tasks t JOIN ancestors a ON t.id=a.parent_id WHERE t.deleted_at IS NULL) SELECT t.* FROM tasks t WHERE t.id IN (SELECT id FROM ancestors) OR ($2 AND t.parent_id IN (SELECT value FROM json_each($1)) AND t.deleted_at IS NULL)")
            .bind(serde_json::json!(task_ids).to_string()).bind(include_children).fetch_all(&mut **tx).await?;
        for row in rows {
            records.insert(record("tasks", &row));
        }
        for (key, table) in [
            ("boardId", "boards"),
            ("statusId", "statuses"),
            ("executorAgentId", "agents"),
            ("latestExecutionSummaryId", "execution_summaries"),
        ] {
            let ids: Vec<_> = records
                .list("tasks")
                .iter()
                .filter_map(|r| r.reference(key))
                .collect();
            load_ids(tx, records, table, &ids).await?;
        }
    }
    let agents: Vec<_> = records.list("agents").iter().map(|r| r.id).collect();
    let teams: Vec<_> = records.list("teams").iter().map(|r| r.id).collect();
    if !agents.is_empty() || !teams.is_empty() {
        let rows = sqlx::query("SELECT * FROM memberships WHERE deleted_at IS NULL AND (agent_id IN (SELECT value FROM json_each($1)) OR team_id IN (SELECT value FROM json_each($2)))")
            .bind(serde_json::json!(agents).to_string()).bind(serde_json::json!(teams).to_string()).fetch_all(&mut **tx).await?;
        for row in rows {
            records.insert(record("memberships", &row));
        }
        let team_ids: Vec<_> = records
            .list("memberships")
            .iter()
            .filter_map(|r| r.reference("teamId"))
            .chain(teams)
            .collect();
        let rows = sqlx::query(
            "SELECT * FROM teams WHERE deleted_at IS NULL AND (leader_id IN (SELECT value FROM json_each($1)) OR id IN (SELECT value FROM json_each($2)))",
        )
        .bind(serde_json::json!(agents).to_string())
        .bind(serde_json::json!(team_ids).to_string())
        .fetch_all(&mut **tx)
        .await?;
        for row in rows {
            records.insert(record("teams", &row));
        }
    }
    Ok(())
}
