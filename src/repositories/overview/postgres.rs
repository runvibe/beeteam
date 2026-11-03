//! Complete task-scoped SQL aggregates and bounded historical read models.
use crate::repositories::reads;
use crate::{
    dto::backend::{Command, Result},
    repositories::records::{Records, Selection},
};
use serde_json::{json, Value};
use sqlx::{Postgres, Row, Transaction};

pub(crate) async fn select(tx: &mut Transaction<'_, Postgres>, c: &Command) -> Result<Selection> {
    let id = c.id("taskId")?;
    let status_rows=sqlx::query("SELECT CAST(t.board_id AS TEXT) AS board_id, CAST(t.status_id AS TEXT) AS status_id, b.data->>'name' AS board_name, s.data->>'name' AS status_name, (s.data->>'isDone')::boolean AS is_done, count(*) AS total, sum(CASE WHEN (t.data->'block'->>'blocked')::boolean THEN 1 ELSE 0 END) AS blocked FROM tasks t JOIN statuses s ON s.id=t.status_id JOIN boards b ON b.id=t.board_id WHERE t.parent_id=$1 AND t.deleted_at IS NULL GROUP BY t.board_id,t.status_id,board_name,status_name,is_done ORDER BY t.board_id,t.status_id")
        .bind(id.clone()).fetch_all(&mut **tx).await?;
    let mut total = 0i64;
    let mut done = 0i64;
    let mut blocked = 0i64;
    let by_status:Vec<Value>=status_rows.into_iter().map(|r|{
        let count=r.get::<i64,_>("total"); let is_done=r.get::<bool,_>("is_done"); let block=r.get::<i64,_>("blocked");
        total+=count; if is_done {done+=count;} blocked+=block;
        json!({"boardId":r.get::<String,_>("board_id"),"boardName":r.get::<Option<String>,_>("board_name"),"statusId":r.get::<String,_>("status_id"),"statusName":r.get::<String,_>("status_name"),"isDone":is_done,"total":count,"blocked":block,"color":null})
    }).collect();
    let executor_rows=sqlx::query("SELECT CAST(t.executor_agent_id AS TEXT) AS executor_id,a.data->>'name' AS agent_name,count(*) AS total,sum(CASE WHEN (s.data->>'isDone')::boolean THEN 1 ELSE 0 END) AS done FROM tasks t JOIN statuses s ON s.id=t.status_id LEFT JOIN agents a ON a.id=t.executor_agent_id WHERE t.parent_id=$1 AND t.deleted_at IS NULL GROUP BY t.executor_agent_id,agent_name ORDER BY t.executor_agent_id")
        .bind(id.clone()).fetch_all(&mut **tx).await?;
    let by_executor:Vec<Value>=executor_rows.into_iter().map(|r|{let total=r.get::<i64,_>("total");let done=r.get::<i64,_>("done");json!({"executorAgentId":r.get::<String,_>("executor_id"),"agentName":r.get::<Option<String>,_>("agent_name"),"total":total,"done":done,"remaining":total-done})}).collect();
    let progress_total:i64=sqlx::query_scalar("SELECT count(*) FROM events WHERE task_id=$1 AND deleted_at IS NULL AND ((data->>'type'='task.updated' AND data->'data'->'changes'->'progress'->>'percent' IS NOT NULL) OR (data->>'type'='execution.recorded' AND data->'data'->'progress'->>'percent' IS NOT NULL))")
        .bind(id.clone()).fetch_one(&mut **tx).await?;
    let progress_rows=sqlx::query("SELECT * FROM events WHERE task_id=$1 AND deleted_at IS NULL AND ((data->>'type'='task.updated' AND data->'data'->'changes'->'progress'->>'percent' IS NOT NULL) OR (data->>'type'='execution.recorded' AND data->'data'->'progress'->>'percent' IS NOT NULL)) ORDER BY sequence DESC LIMIT 100")
        .bind(id.clone()).fetch_all(&mut **tx).await?;
    let mut progress:Vec<Value>=progress_rows.iter().map(|r|{let e=reads::record("events",r).value();let p=if e["type"]=="execution.recorded" {&e["data"]["progress"]} else {&e["data"]["changes"]["progress"]};json!({"eventId":e["id"],"occurredAt":e["occurredAt"],"actorKind":e["actorKind"],"actorId":e["actorId"],"percent":p["percent"],"note":p["note"],"source":e["type"],"summaryId":e["data"]["executionSummaryId"]})}).collect();
    progress.reverse();
    let summary_row=sqlx::query("SELECT * FROM events WHERE task_id=$1 AND deleted_at IS NULL AND (data->'data'->>'currentSummary' IS NOT NULL OR data->'data'->'changes'->>'currentSummary' IS NOT NULL) ORDER BY sequence DESC LIMIT 1")
        .bind(id.clone()).fetch_optional(&mut **tx).await?;
    let summary_event = summary_row
        .as_ref()
        .map(|r| reads::record("events", r).value());
    let deliveries_total:i64=sqlx::query_scalar("SELECT count(*) FROM execution_summaries r CROSS JOIN LATERAL jsonb_array_elements(r.data->'deliverables') WITH ORDINALITY AS delivery(value,ordinal) WHERE r.task_id=$1 AND r.deleted_at IS NULL")
        .bind(id.clone()).fetch_one(&mut **tx).await?;
    let delivery_rows=sqlx::query("SELECT r.*,delivery.value AS delivery FROM execution_summaries r CROSS JOIN LATERAL jsonb_array_elements(r.data->'deliverables') WITH ORDINALITY AS delivery(value,ordinal) WHERE r.task_id=$1 AND r.deleted_at IS NULL ORDER BY r.created_at DESC,r.id DESC,delivery.ordinal DESC LIMIT 10")
        .bind(id).fetch_all(&mut **tx).await?;
    let deliveries:Vec<Value>=delivery_rows.iter().map(|r|{let s=reads::record("execution_summaries",r).value();json!({"summaryId":s["id"],"createdAt":s["createdAt"],"actorKind":s["actorKind"],"actorId":s["actorId"],"deliverable":r.get::<Value,_>("delivery")})}).collect();
    let data = json!({"directSubtasks":{"total":total,"done":done,"remaining":total-done,"blocked":blocked,"archivedIncluded":true,"byStatus":by_status,"byExecutor":by_executor},"progressHistory":{"items":progress,"total":progress_total,"limit":100,"truncated":progress_total>100,"coverage":"explicit_progress_events_only"},"summaryEvent":summary_event,"latestDeliverables":{"items":deliveries,"total":deliveries_total,"limit":10,"truncated":deliveries_total>10}});
    Ok(Selection {
        items: vec![data],
        total: 1,
        offset: 0,
        limit: 1,
        records: Records::default(),
        table: "overview",
    })
}
