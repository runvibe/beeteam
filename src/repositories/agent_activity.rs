//! A single attributed event selected inside the caller's read snapshot.
use super::records::{Records, Selection};
use crate::dto::backend::{Command, Result};
use serde_json::{json, Value};
use sqlx::{Postgres, Row, Sqlite, Transaction};

// Keep subsecond precision separately: SQLite date functions round fractions and
// PostgreSQL timestamps round to microseconds. JSON event timestamps can contain
// nanoseconds. Normalize only whole seconds/timezone, then compare 9 fraction digits.
const SOURCE: &str = r#"WITH attributed AS (
 SELECT CAST(e.id AS TEXT) AS event_id, CAST(t.id AS TEXT) AS task_id,
 t.data->>'slug' AS task_slug, t.data->>'title' AS task_title,
 e.data->>'type' AS event_type, e.data->>'occurredAt' AS stamp,
 CAST(e.data->>'sequence' AS BIGINT) AS sequence,
 CAST(s.id AS TEXT) AS summary_id
 FROM events e JOIN tasks t ON t.id=e.task_id AND t.deleted_at IS NULL
 JOIN boards b ON b.id=t.board_id AND b.deleted_at IS NULL
 LEFT JOIN execution_summaries s ON s.id=SUMMARY_REFERENCE
   AND e.data->>'type'='execution.recorded' AND s.task_id=t.id AND s.deleted_at IS NULL
 WHERE e.deleted_at IS NULL AND e.data->>'actorKind'='agent' AND e.data->>'actorId'=$1
), timestamp_parts AS (
 SELECT *, CASE WHEN substr(stamp,length(stamp),1) IN ('Z','z') THEN 1 ELSE 6 END AS zone_length
 FROM attributed
), ordered AS (
 SELECT *, substr(stamp,1,19) || substr(stamp,length(stamp)-zone_length+1) AS whole_seconds,
 substr((CASE WHEN substr(stamp,20,1)='.' THEN substr(stamp,21,length(stamp)-20-zone_length) ELSE '' END) || '000000000',1,9) AS fraction
 FROM timestamp_parts
)
SELECT event_id,task_id,task_slug,task_title,event_type,stamp,summary_id FROM ordered
ORDER BY "#;

fn selection(items: Vec<Value>) -> Selection {
    Selection {
        total: items.len(),
        items,
        offset: 0,
        limit: 1,
        records: Records::default(),
        table: "agent_activity",
    }
}

pub(super) async fn postgres(tx: &mut Transaction<'_, Postgres>, c: &Command) -> Result<Selection> {
    let sql = format!("{SOURCE} CAST(whole_seconds AS timestamptz) DESC, fraction DESC, sequence DESC, event_id DESC LIMIT 1").replace("SUMMARY_REFERENCE", "CAST(e.data->'data'->>'executionSummaryId' AS uuid)");
    let row = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(c.id("agentId")?.to_string())
        .fetch_optional(&mut **tx)
        .await?;
    Ok(selection(row.map(|r| json!({
        "type":r.get::<String,_>("event_type"), "occurredAt":r.get::<String,_>("stamp"),
        "taskId":r.get::<String,_>("task_id"), "taskSlug":r.get::<String,_>("task_slug"),
        "taskTitle":r.get::<String,_>("task_title"), "eventId":r.get::<String,_>("event_id"),
        "summaryId":r.get::<Option<String>,_>("summary_id")
    })).into_iter().collect()))
}

pub(super) async fn sqlite(tx: &mut Transaction<'_, Sqlite>, c: &Command) -> Result<Selection> {
    let sql = format!("{SOURCE} datetime(whole_seconds) DESC, fraction DESC, sequence DESC, event_id DESC LIMIT 1").replace("SUMMARY_REFERENCE", "e.data->'data'->>'executionSummaryId'");
    let row = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(c.id("agentId")?.to_string())
        .fetch_optional(&mut **tx)
        .await?;
    Ok(selection(row.map(|r| json!({
        "type":r.get::<String,_>("event_type"), "occurredAt":r.get::<String,_>("stamp"),
        "taskId":r.get::<String,_>("task_id"), "taskSlug":r.get::<String,_>("task_slug"),
        "taskTitle":r.get::<String,_>("task_title"), "eventId":r.get::<String,_>("event_id"),
        "summaryId":r.get::<Option<String>,_>("summary_id")
    })).into_iter().collect()))
}
