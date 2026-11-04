use super::hierarchy;
use crate::{
    dto::backend::*,
    repositories::{contracts::UnitOfWork, records::Records},
};
use serde_json::{json, Value};
use uuid::Uuid;

pub(super) fn resource(records: &Records, table: &str, id: Uuid) -> Result<Value> {
    let r = records.get(table, id)?;
    let mut value = r.value();
    match table {
        "agents" => {
            let leader = records
                .list("teams")
                .into_iter()
                .find(|t| t.reference("leaderId") == Some(id))
                .map(|t| t.id);
            let collaborator = records
                .list("memberships")
                .into_iter()
                .find(|m| m.reference("agentId") == Some(id))
                .and_then(|m| m.reference("teamId"));
            value["bindings"] = json!({"leaderTeamId":leader,"collaboratorTeamId":collaborator});
        }
        "teams" => {
            value["collaboratorCount"] = json!(records
                .list("memberships")
                .iter()
                .filter(|m| m.reference("teamId") == Some(id))
                .count())
        }
        "tasks" => {
            let children: Vec<_> = records
                .list("tasks")
                .into_iter()
                .filter(|t| t.reference("parentId") == Some(id))
                .collect();
            let done = children
                .iter()
                .filter(|t| {
                    t.reference("statusId")
                        .and_then(|id| records.get("statuses", id).ok())
                        .is_some_and(|s| s.data["isDone"] == true)
                })
                .count();
            value["parentReference"] = match r.reference("parentId") {
                Some(parent_id) => {
                    let parent = records.get("tasks", parent_id)?;
                    json!({"id":parent.id,"title":parent.data["title"],"slug":parent.data["slug"]})
                }
                None => Value::Null,
            };
            value["childSummary"] = json!({"total":children.len(),"done":done});
            value["executionContext"] = hierarchy::context(records, id)?;
        }
        _ => {}
    }
    Ok(value)
}
pub(super) async fn run(unit: &mut UnitOfWork, c: &Command) -> Result<Value> {
    let records = &unit.records;
    for (key, table) in [
        ("agentId", "agents"),
        ("teamId", "teams"),
        ("boardId", "boards"),
        ("taskId", "tasks"),
        ("planId", "plans"),
    ] {
        if c.params.contains_key(key) {
            records.get(table, c.id(key)?)?;
        }
    }
    for (key, table) in [
        ("boardId", "boards"),
        ("teamId", "teams"),
        ("parentId", "tasks"),
        ("statusId", "statuses"),
        ("authorAgentId", "agents"),
        ("executorAgentId", "agents"),
        ("leaderId", "agents"),
        ("collaboratorId", "agents"),
        ("actorId", "agents"),
    ] {
        if let Some(value) = c.query.get(key) {
            // Historical comment authors remain filterable after profile deletion.
            // UUID syntax is validated by the shared query DTO; no profile is inferred.
            if key == "actorId" && c.operation == "listComments" {
                continue;
            }
            records.get(table, value_id(value)?)?;
        }
    }
    if let (Some(board), Some(status)) = (
        c.params
            .get("boardId")
            .map(|v| json!(v))
            .or_else(|| c.query.get("boardId").cloned()),
        c.query.get("statusId"),
    ) {
        if records.get("statuses", value_id(status)?)?.data["boardId"] != board {
            return Err(Failure::missing());
        }
    }
    if c.params.contains_key("intervalId") {
        let interval=records.get("task_execution_intervals",c.id("intervalId")?)?;
        if interval.reference("taskId")!=Some(c.id("taskId")?) {return Err(Failure::missing());}
    }
    match c.operation.as_str() {
        "getTaskExecutionIntervalUsage" | "getTaskUsage" | "listTaskUsageDimensions" => Ok(unit.select(c).await?.items.remove(0)),
        "getAgent" => resource(records, "agents", c.id("agentId")?),
        "getTeam" => resource(records, "teams", c.id("teamId")?),
        "getBoard" => resource(records, "boards", c.id("boardId")?),
        "getComment" => comment(records, c.id("taskId")?, c.id("commentId")?),
        "getTask" => resource(records, "tasks", c.id("taskId")?),
        "getTaskOverview" => super::overview::read(unit, c).await,
        "getBoardView" => board_view(unit, c).await,
        "listAgentActivities" => activities(unit, c).await,
        _ => list(unit, c).await,
    }
}
async fn list(unit: &mut UnitOfWork, c: &Command) -> Result<Value> {
    let page = unit.select(c).await?;
    let mut items = page.items;
    if c.operation == "getTimelinePoints" {
        // SQL keeps actorId only for filtering. The output contract has exactly five fields.
        items = items.into_iter().map(|item| {
            let point: crate::dto::timeline::TimelinePoint = serde_json::from_value(item)
                .map_err(|_| Failure::new("internal_error", "Invalid timeline point projection"))?;
            serde_json::to_value(point)
                .map_err(|_| Failure::new("internal_error", "Unable to serialize timeline point"))
        }).collect::<Result<Vec<_>>>()?;
    }
    if page.table == "tasks" && c.operation != "listAgentActivities" {
        for item in &mut items {
            let id = value_id(&item["id"])?;
            let value = resource(&unit.records, "tasks", id)?;
            item["parentReference"] = value["parentReference"].clone();
            item["childSummary"] = value["childSummary"].clone();
            item["executionContext"] = value["executionContext"].clone();
        }
    }
    if c.operation == "listAgentActivities" {
        let actor = c.id("agentId")?;
        for item in &mut items {
            let id = value_id(&item["taskId"])?;
            item["taskPath"] = json!(format!("/api/v1/tasks/{id}"));
            item["summariesPath"] = json!(format!(
                "/api/v1/tasks/{id}/execution-summaries?actorId={actor}"
            ));
        }
    }
    let next = page.offset + items.len();
    let more = next < page.total;
    Ok(
        json!({"items":items,"offset":page.offset,"limit":page.limit,"total":page.total,"hasMore":more,"nextOffset":if more {Some(next)}else{None}}),
    )
}
async fn board_view(unit: &mut UnitOfWork, c: &Command) -> Result<Value> {
    let id = c.id("boardId")?;
    let mut statuses = unit
        .records
        .list("statuses")
        .into_iter()
        .filter(|s| s.reference("boardId") == Some(id) && s.archived_at.is_none())
        .cloned()
        .collect::<Vec<_>>();
    statuses.sort_by_key(|s| s.data["position"].as_i64().unwrap_or(0));
    let mut columns = Vec::new();
    for status in statuses {
        let mut query = c.clone();
        query.operation = "listTasks".into();
        query.query.remove("limitPerColumn");
        query.query.insert("limit".into(), c.q("limitPerColumn"));
        query.query.insert("statusId".into(), json!(status.id));
        query.query.insert("archived".into(), json!(false));
        query.query.insert("sortBy".into(), json!("position"));
        let mut column = list(unit, &query).await?;
        column["status"] = resource(&unit.records, "statuses", status.id)?;
        column["tasks"] = column["items"].take();
        column.as_object_mut().unwrap().remove("items");
        columns.push(column);
    }
    Ok(json!({"boardId":id,"columns":columns}))
}
async fn activities(unit: &mut UnitOfWork, c: &Command) -> Result<Value> {
    if c.query.contains_key("statusId") && !c.query.contains_key("boardId") {
        return Err(Failure::invalid("statusId requires boardId"));
    }
    list(unit, c).await
}

fn comment(records: &Records, task_id: Uuid, comment_id: Uuid) -> Result<Value> {
    let comment = records.get("comments", comment_id)?;
    if comment.reference("taskId") != Some(task_id) {
        return Err(Failure::missing());
    }
    Ok(comment.value())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repositories::records::Record;

    #[test]
    fn deleted_or_unrelated_comments_are_not_readable() {
        let task_id = Uuid::now_v7();
        let mut records = Records::default();
        let id = records.insert(Record::new(
            "comments",
            json!({"taskId":task_id,"body":"kept"}),
        ));
        assert_eq!(comment(&records, task_id, id).unwrap()["body"], "kept");
        assert_eq!(
            comment(&records, Uuid::now_v7(), id).unwrap_err().code,
            "not_found"
        );
        records.get_mut("comments", id).unwrap().deleted_at = Some(chrono::Utc::now());
        assert_eq!(
            comment(&records, task_id, id).unwrap_err().code,
            "not_found"
        );
    }
}
