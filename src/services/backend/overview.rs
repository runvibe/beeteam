use super::{project, queries};
use crate::{
    dto::{backend::*, contracts},
    repositories::contracts::UnitOfWork,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub(super) async fn read(unit: &mut UnitOfWork, c: &Command) -> Result<Value> {
    let id = c.id("taskId")?;
    let mut selected = unit.select(c).await?;
    let mut data = selected.items.remove(0);
    let mut task = queries::resource(&unit.records, "tasks", id)?;
    task["childSummary"] =
        json!({"total":data["directSubtasks"]["total"],"done":data["directSubtasks"]["done"]});
    let doc = &contracts::operation("getTask")?.document;
    data["task"] = project(doc, &doc["components"]["schemas"]["Task"], &task);
    let event = data
        .as_object_mut()
        .unwrap()
        .remove("summaryEvent")
        .unwrap_or(Value::Null);
    let synthesis = event["data"]
        .get("currentSummary")
        .or_else(|| event["data"]["changes"].get("currentSummary"));
    data["currentSummaryMeta"] = if synthesis == Some(&task["currentSummary"]) && !event.is_null() {
        json!({"eventId":event["id"],"occurredAt":event["occurredAt"],"actorKind":event["actorKind"],"actorId":event["actorId"]})
    } else {
        Value::Null
    };
    data["latestExecutionSummary"] = if let Some(sid) = unit
        .records
        .get("tasks", id)?
        .reference("latestExecutionSummaryId")
    {
        project(
            doc,
            &doc["components"]["schemas"]["ExecutionSummary"],
            &unit.records.get("execution_summaries", sid)?.value(),
        )
    } else {
        Value::Null
    };
    for (key, operation, limit, sort) in [
        ("latestAttachments", "listAttachments", 5, "createdAt"),
        ("recentEvents", "getTimeline", 20, "sequence"),
    ] {
        let query = Command {
            operation: operation.into(),
            params: c.params.clone(),
            query: BTreeMap::from([
                ("limit".into(), json!(limit)),
                ("offset".into(), json!(0)),
                ("sortBy".into(), json!(sort)),
                ("sortOrder".into(), json!("desc")),
            ]),
            body: json!({}),
            actor: None,
            expected_version: None,
            idempotency_key: None,
            upload: None,
        };
        let page = unit.select(&query).await?;
        data[key] = json!({"items":page.items,"total":page.total,"limit":limit,"truncated":page.total>limit});
    }
    data["nextStep"] = Value::Null;
    data["decisions"] = json!([]);
    Ok(data)
}
