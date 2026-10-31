//! Task-scoped distinct participant read model; SQL is bounded by task, not comment pages.
use super::records::{Records, Selection};
use crate::dto::backend::{Command, Result};
use serde_json::json;
use sqlx::{Postgres, Row, Sqlite, Transaction};

const SOURCE: &str = r#"WITH identities AS (
 SELECT 'agent' AS actor_kind, data->>'authorAgentId' AS actor_id FROM tasks WHERE id=$1 AND deleted_at IS NULL
 UNION ALL SELECT 'agent', data->>'executorAgentId' FROM tasks WHERE id=$1 AND deleted_at IS NULL
 UNION ALL SELECT data->>'actorKind', data->>'actorId' FROM comments WHERE task_id=$1 AND deleted_at IS NULL
 UNION ALL SELECT data->>'actorKind', data->>'actorId' FROM plan_revisions WHERE task_id=$1 AND deleted_at IS NULL
 UNION ALL SELECT data->>'actorKind', data->>'actorId' FROM attachments WHERE task_id=$1 AND deleted_at IS NULL
 UNION ALL SELECT data->>'actorKind', data->>'actorId' FROM execution_summaries WHERE task_id=$1 AND deleted_at IS NULL
 UNION ALL SELECT data->>'actorKind', data->>'actorId' FROM events WHERE task_id=$1 AND deleted_at IS NULL
 UNION ALL SELECT 'agent', data->'data'->>'authorAgentId' FROM events WHERE task_id=$1 AND deleted_at IS NULL AND data->>'type'='task.created'
 UNION ALL SELECT 'agent', data->'data'->>'executorAgentId' FROM events WHERE task_id=$1 AND deleted_at IS NULL AND data->>'type'='task.created'
 UNION ALL SELECT 'agent', data->'data'->>'previousExecutorAgentId' FROM events WHERE task_id=$1 AND deleted_at IS NULL AND data->>'type'='assignment.changed'
 UNION ALL SELECT 'agent', data->'data'->>'executorAgentId' FROM events WHERE task_id=$1 AND deleted_at IS NULL AND data->>'type'='assignment.changed'
), participants AS (
 SELECT DISTINCT actor_kind, CASE WHEN actor_kind='human' THEN NULL ELSE actor_id END AS actor_id
 FROM identities WHERE actor_kind='human' OR (actor_kind='agent' AND actor_id IS NOT NULL)
)
"#;

pub(super) async fn postgres(tx: &mut Transaction<'_, Postgres>, c: &Command) -> Result<Selection> {
    let task = c.id("taskId")?;
    let count_sql = format!("{SOURCE} SELECT count(*) FROM participants");
    let total: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(count_sql))
        .bind(task.clone())
        .fetch_one(&mut **tx)
        .await?;
    let offset = c.q("offset").as_u64().unwrap_or(0) as usize;
    let limit = c.q("limit").as_u64().unwrap_or(50) as usize;
    let sql = format!("{SOURCE} SELECT p.actor_kind,p.actor_id,a.data->>'name' AS agent_name,(a.archived_at IS NOT NULL) AS archived,(a.deleted_at IS NOT NULL) AS deleted FROM participants p LEFT JOIN agents a ON p.actor_kind='agent' AND a.id=CAST(p.actor_id AS uuid) ORDER BY p.actor_kind,p.actor_id LIMIT $2 OFFSET $3");
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(task)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&mut **tx)
        .await?;
    let items = rows
        .into_iter()
        .map(|row| {
            json!({
                "actorKind":row.get::<String,_>("actor_kind"),
                "actorId":row.get::<Option<String>,_>("actor_id"),
                "agentName":row.get::<Option<String>,_>("agent_name"),
                "agentArchived":row.get::<bool,_>("archived"),
                "agentDeleted":row.get::<bool,_>("deleted")
            })
        })
        .collect();
    Ok(Selection {
        items,
        total: total as usize,
        offset,
        limit,
        records: Records::default(),
        table: "participants",
    })
}

pub(super) async fn sqlite(tx: &mut Transaction<'_, Sqlite>, c: &Command) -> Result<Selection> {
    let task = c.id("taskId")?.to_string();
    let count_sql = format!("{SOURCE} SELECT count(*) FROM participants");
    let total: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(count_sql))
        .bind(task.clone())
        .fetch_one(&mut **tx)
        .await?;
    let offset = c.q("offset").as_u64().unwrap_or(0) as usize;
    let limit = c.q("limit").as_u64().unwrap_or(50) as usize;
    let sql = format!("{SOURCE} SELECT p.actor_kind,p.actor_id,a.data->>'name' AS agent_name,(a.archived_at IS NOT NULL) AS archived,(a.deleted_at IS NOT NULL) AS deleted FROM participants p LEFT JOIN agents a ON p.actor_kind='agent' AND a.id=p.actor_id ORDER BY p.actor_kind,p.actor_id LIMIT $2 OFFSET $3");
    let rows = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(task)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&mut **tx)
        .await?;
    let items = rows
        .into_iter()
        .map(|row| {
            json!({
                "actorKind":row.get::<String,_>("actor_kind"),
                "actorId":row.get::<Option<String>,_>("actor_id"),
                "agentName":row.get::<Option<String>,_>("agent_name"),
                "agentArchived":row.get::<bool,_>("archived"),
                "agentDeleted":row.get::<bool,_>("deleted")
            })
        })
        .collect();
    Ok(Selection {
        items,
        total: total as usize,
        offset,
        limit,
        records: Records::default(),
        table: "participants",
    })
}
