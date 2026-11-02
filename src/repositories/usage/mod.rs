//! Complete SQL aggregates and paged summary checkpoints. No business inference.
pub(super) mod postgres;
pub(super) mod sqlite;
mod recorded_sessions;
use serde_json::{json, Value};

fn page(items: Vec<Value>, total: i64, offset: usize, limit: usize) -> Value {
    json!({"truncated":offset+items.len()<(total as usize),"items":items,"total":total,"offset":offset,"limit":limit})
}
fn timeline(value: Value) -> crate::dto::backend::Result<Value> {
    let mut recorded = recorded_sessions::RecordedSessions::default();
    if let Some(entries) = value["usageReport"]["entries"].as_array() {
        for entry in entries { recorded.push_entry(entry)?; }
    }
    Ok(json!({"summaryId":value["id"],"reportedAt":value["createdAt"],"reportingActor":{"actorKind":value["actorKind"],"actorId":value["actorId"]},"statusObserved":value.get("statusObserved").cloned().unwrap_or(Value::Null),"usageReport":value.get("usageReport").cloned().unwrap_or(Value::Null),"recordedSessionUsage":recorded.value()}))
}

fn dimension_sql(kind: &str) -> String {
    let fields = if kind == "model" {
        "entry->'observation'->>'provider' AS provider, entry->'observation'->>'modelId' AS model_id, NULL AS harness"
    } else {
        "NULL AS provider, NULL AS model_id, entry->'observation'->>'harness' AS harness"
    };
    let field = if kind == "model" {
        "modelId"
    } else {
        "harness"
    };
    format!("SELECT DISTINCT {fields} FROM summary_usage_entries WHERE task_id=$1 AND entry->'observation'->>'{field}' IS NOT NULL")
}
fn stats_sql() -> String {
    let counted = "CAST(entry->>'counted' AS TEXT) IN ('true','1')";
    let mut fields = Vec::new();
    for (alias, component, quality) in [
        ("known", "totalTokens", "measured"),
        ("estimated", "totalTokens", "estimated"),
        ("input", "inputTokens", "measured"),
        ("output", "outputTokens", "measured"),
        ("cached", "cachedInputTokens", "measured"),
        ("reasoning", "reasoningOutputTokens", "measured"),
    ] {
        fields.push(format!("CAST(SUM(CASE WHEN {counted} AND entry->'observation'->>'quality'='{quality}' THEN CAST(entry->'delta'->>'{component}' AS BIGINT) END) AS TEXT) AS {alias}"));
    }
    for (alias,condition) in [("entries","1=1"),("measured","entry->'observation'->>'quality'='measured'"),("estimated_count","entry->'observation'->>'quality'='estimated'"),("unavailable","entry->'observation'->>'reportKind'='unavailable'"),("baseline","entry->>'coverageReason'='baseline_or_unavailable' AND entry->'observation'->>'reportKind'<>'unavailable'"),("duplicates","entry->>'coverageReason'='duplicate_reference'"),("unallocated","entry->>'coverageReason'='shared_or_unallocated'")] {
        fields.push(format!("COUNT(CASE WHEN {condition} THEN 1 END) AS {alias}"));
    }
    format!(
        "SELECT {} FROM summary_usage_entries WHERE task_id=$1",
        fields.join(",")
    )
}
