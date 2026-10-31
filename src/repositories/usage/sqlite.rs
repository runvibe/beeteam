use super::{dimension_sql, page, stats_sql, timeline};
use crate::{
    dto::backend::{Command, Result},
    repositories::records::{Records, Selection},
};
use serde_json::{json, Value};
use sqlx::{Row, Sqlite, Transaction};

pub(crate) async fn select(tx: &mut Transaction<'_, Sqlite>, c: &Command) -> Result<Selection> {
    let id = c.id("taskId")?.to_string();
    let offset = c.q("offset").as_u64().unwrap_or(0) as usize;
    let limit = c.q("limit").as_u64().unwrap_or(20) as usize;
    if c.operation == "listTaskUsageDimensions" {
        let kind = c.q("kind").as_str().unwrap_or("model").to_owned();
        let data = dimensions(tx, &id, &kind, offset, limit).await?;
        return Ok(Selection {
            items: vec![data],
            total: 1,
            offset: 0,
            limit: 1,
            records: Records::default(),
            table: "usage",
        });
    }
    let sql = stats_sql();
    let row = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id.clone())
        .fetch_one(&mut **tx)
        .await?;
    let known = row.get::<Option<String>, _>("known");
    let summary_count=sqlx::query("SELECT count(*) AS total, COUNT(CASE WHEN data->'usageReport'->>'revision' IS NOT NULL THEN 1 END) AS reported FROM execution_summaries WHERE task_id=$1 AND deleted_at IS NULL").bind(id.clone()).fetch_one(&mut **tx).await?;
    let total = summary_count.get::<i64, _>("total");
    let reported = summary_count.get::<i64, _>("reported");
    let rows=sqlx::query("SELECT * FROM execution_summaries WHERE task_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3").bind(id.clone()).bind(limit as i64).bind(offset as i64).fetch_all(&mut **tx).await?;
    let items = rows
        .iter()
        .map(|r| {
            timeline(crate::repositories::sqlite::reads::record("execution_summaries", r).value())
        })
        .collect();
    let models = dimensions(tx, &id, "model", 0, 100).await?;
    let harnesses = dimensions(tx, &id, "harness", 0, 100).await?;
    let data = json!({"knownTotalTokens":known,"estimatedTotalTokens":row.get::<Option<String>,_>("estimated"),
        "measuredComponents":{"inputTokens":row.get::<Option<String>,_>("input"),"outputTokens":row.get::<Option<String>,_>("output"),"cachedInputTokens":row.get::<Option<String>,_>("cached"),"reasoningOutputTokens":row.get::<Option<String>,_>("reasoning"),"totalTokens":known},
        "coverage":{"totalSummaries":total,"reportedSummaries":reported,"missingSummaries":total-reported,
            "entries":row.get::<i64,_>("entries"),"measuredEntries":row.get::<i64,_>("measured"),"estimatedEntries":row.get::<i64,_>("estimated_count"),"unavailableEntries":row.get::<i64,_>("unavailable"),"baselineEntries":row.get::<i64,_>("baseline"),"duplicateEntries":row.get::<i64,_>("duplicates"),"unallocatedEntries":row.get::<i64,_>("unallocated")},
        "models":models,"harnesses":harnesses,"timeline":page(items,total,offset,limit)});
    Ok(Selection {
        items: vec![data],
        total: 1,
        offset: 0,
        limit: 1,
        records: Records::default(),
        table: "usage",
    })
}
async fn dimensions(
    tx: &mut Transaction<'_, Sqlite>,
    id: &String,
    kind: &str,
    offset: usize,
    limit: usize,
) -> Result<Value> {
    let base = dimension_sql(kind);
    let count: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
        "SELECT count(*) FROM ({base}) d"
    )))
    .bind(id.clone())
    .fetch_one(&mut **tx)
    .await?;
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "{base} ORDER BY provider,model_id,harness LIMIT $2 OFFSET $3"
    )))
    .bind(id.clone())
    .bind(limit as i64)
    .bind(offset as i64)
    .fetch_all(&mut **tx)
    .await?;
    let items=rows.into_iter().map(|r|json!({"provider":r.get::<Option<String>,_>("provider"),"modelId":r.get::<Option<String>,_>("model_id"),"harness":r.get::<Option<String>,_>("harness")})).collect();
    Ok(page(items, count, offset, limit))
}
