use super::hierarchy;
use crate::{dto::backend::*, repositories::resources::Records};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
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
            value["childSummary"] = json!({"total":children.len(),"done":done});
            value["executionContext"] = hierarchy::context(records, id)?;
        }
        _ => {}
    }
    Ok(value)
}
pub(super) fn run(records: &Records, c: &Command) -> Result<Value> {
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
    match c.operation.as_str() {
        "getAgent" => resource(records, "agents", c.id("agentId")?),
        "getTeam" => resource(records, "teams", c.id("teamId")?),
        "getBoard" => resource(records, "boards", c.id("boardId")?),
        "getTask" => resource(records, "tasks", c.id("taskId")?),
        "getBoardView" => board_view(records, c),
        "getResumptionContext" => resume(records, c),
        "listAgentActivities" => activities(records, c),
        "listTeamMembers" => {
            let id = c.id("teamId")?;
            let team = records.get("teams", id)?;
            let mut ids = vec![(team.reference("leaderId").unwrap(), "leader")];
            ids.extend(
                records
                    .list("memberships")
                    .iter()
                    .filter(|m| m.reference("teamId") == Some(id))
                    .map(|m| (m.reference("agentId").unwrap(), "collaborator")),
            );
            let items=ids.into_iter().map(|(id,role)|{let a=records.get("agents",id)?;Ok(json!({"agentId":id,"name":a.data["name"],"role":role,"agentArchivedAt":a.archived_at}))}).collect::<Result<Vec<_>>>()?;
            page(items, c, "agentId")
        }
        _ => list(records, c),
    }
}
fn list(records: &Records, c: &Command) -> Result<Value> {
    let table = match c.operation.as_str() {
        "listAgents" => "agents",
        "listTeams" => "teams",
        "listBoards" => "boards",
        "listStatuses" => "statuses",
        "listTasks" | "listAllTasks" => "tasks",
        "listPlans" | "listPlanRevisions" => "plan_revisions",
        "listComments" => "comments",
        "listAttachments" => "attachments",
        "listExecutionSummarys" => "execution_summaries",
        "getTimeline" => "events",
        "listChatReferences" => "chat_references",
        _ => return Err(Failure::missing()),
    };
    let descendants = if table == "events" && c.q("includeChildren") == true {
        Some(hierarchy::descendants(records, c.id("taskId")?)?)
    } else {
        None
    };
    let mut rows = Vec::new();
    for r in records.rows.values().filter(|r| r.table == table) {
        if r.deleted_at.is_some() && !(table == "attachments" && c.q("includeRemoved") == true) {
            continue;
        }
        let mut matches = true;
        for key in ["boardId", "taskId", "agentId", "planId"] {
            if let Some(id) = c.params.get(key) {
                if key == "taskId" && descendants.is_some() {
                    matches &= r
                        .reference("taskId")
                        .is_some_and(|id| descendants.as_ref().unwrap().contains(&id));
                } else {
                    matches &= r.data[key] == *id;
                }
            }
        }
        if !matches {
            continue;
        }
        let mut value = if r.deleted_at.is_some() {
            r.value()
        } else {
            resource(records, table, r.id)?
        };
        if table == "tasks" {
            value["_archived"] = json!(hierarchy::archived(records, r.id)?);
        }
        if table == "agents" && (c.query.contains_key("teamId") || c.query.contains_key("role")) {
            let role = c.q("role");
            let team = c.q("teamId");
            let binding = &value["bindings"];
            let has = |field: &str| {
                !binding[field].is_null() && (team.is_null() || binding[field] == team)
            };
            if !match role.as_str() {
                Some("leader") => has("leaderTeamId"),
                Some("collaborator") => has("collaboratorTeamId"),
                _ => has("leaderTeamId") || has("collaboratorTeamId"),
            } {
                continue;
            }
        }
        if table == "teams"
            && c.query.contains_key("collaboratorId")
            && !records.list("memberships").iter().any(|m| {
                m.reference("teamId") == Some(r.id) && m.data["agentId"] == c.q("collaboratorId")
            })
        {
            continue;
        }
        rows.push(value);
    }
    if c.operation == "listPlans" {
        let mut latest: BTreeMap<String, Value> = BTreeMap::new();
        for row in rows {
            let key = row["planId"].as_str().unwrap().to_owned();
            if latest
                .get(&key)
                .is_none_or(|old| old["revision"].as_i64() < row["revision"].as_i64())
            {
                latest.insert(key, row);
            }
        }
        rows = latest.into_values().collect();
    }
    page(rows, c, "id")
}
pub(super) fn page(mut items: Vec<Value>, c: &Command, id_key: &str) -> Result<Value> {
    items.retain(|row| matches_filters(row, c));
    let sort = c.q("sortBy");
    let sort = sort.as_str().unwrap_or("createdAt");
    let descending = c.q("sortOrder") == "desc";
    items.sort_by(|a, b| {
        let compare = |a: &Value, b: &Value| {
            if let (Some(a), Some(b)) = (a.as_f64(), b.as_f64()) {
                a.total_cmp(&b)
            } else {
                a.as_str().unwrap_or("").cmp(b.as_str().unwrap_or(""))
            }
        };
        let order = compare(&a[sort], &b[sort]).then_with(|| compare(&a[id_key], &b[id_key]));
        if descending {
            order.reverse()
        } else {
            order
        }
    });
    let total = items.len();
    let offset = c.q("offset").as_u64().unwrap_or(0) as usize;
    let limit = c.q("limit").as_u64().unwrap_or(50) as usize;
    let items: Vec<_> = items.into_iter().skip(offset).take(limit).collect();
    let has_more = offset + items.len() < total;
    Ok(
        json!({"items":items,"offset":offset,"limit":limit,"total":total,"hasMore":has_more,"nextOffset":if has_more{Some(offset+items.len())}else{None}}),
    )
}
fn matches_filters(row: &Value, c: &Command) -> bool {
    for (key, expected) in &c.query {
        if matches!(
            key.as_str(),
            "offset"
                | "limit"
                | "sortBy"
                | "sortOrder"
                | "includeChildren"
                | "includeRemoved"
                | "limitPerColumn"
                | "taskIds"
                | "relation"
                | "collaboratorId"
        ) {
            continue;
        }
        if c.operation == "listAgents" && matches!(key.as_str(), "role" | "teamId") {
            continue;
        }
        if key == "includeArchived" {
            if *expected == false && !row["archivedAt"].is_null() {
                return false;
            }
            continue;
        }
        if key == "archived" {
            let archived = row["_archived"]
                .as_bool()
                .unwrap_or(!row["archivedAt"].is_null());
            if expected.as_bool() != Some(archived) {
                return false;
            }
            continue;
        }
        if key == "rootOnly" {
            if *expected == true && !row["parentId"].is_null() {
                return false;
            }
            continue;
        }
        if key == "blocked" {
            if row["block"]["blocked"] != *expected {
                return false;
            }
            continue;
        }
        if key == "types" {
            if !expected
                .as_array()
                .unwrap()
                .iter()
                .any(|t| row["type"] == *t)
            {
                return false;
            }
            continue;
        }
        if key.ends_with("From") || key.ends_with("Before") {
            let prefix = key.trim_end_matches("From").trim_end_matches("Before");
            let field = if prefix == "updated" && c.operation == "listAgentActivities" {
                "taskUpdatedAt".into()
            } else {
                format!("{prefix}At")
            };
            let actual = row[&field]
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok());
            let bound = expected
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok());
            if let (Some(actual), Some(bound)) = (actual, bound) {
                if (key.ends_with("From") && actual < bound)
                    || (key.ends_with("Before") && actual >= bound)
                {
                    return false;
                }
            } else {
                return false;
            }
            continue;
        }
        if matches!(key.as_str(), "name" | "title" | "label" | "fileName") {
            let field = if key == "fileName" {
                "originalName"
            } else {
                key
            };
            if !row[field]
                .as_str()
                .unwrap_or("")
                .to_lowercase()
                .contains(&expected.as_str().unwrap_or("").to_lowercase())
            {
                return false;
            }
            continue;
        }
        if key == "mediaType" {
            if row[key].as_str().unwrap_or("").to_lowercase()
                != expected.as_str().unwrap_or("").to_lowercase()
            {
                return false;
            }
            continue;
        }
        if row[key] != *expected {
            return false;
        }
    }
    true
}
fn board_view(records: &Records, c: &Command) -> Result<Value> {
    let id = c.id("boardId")?;
    let mut statuses = records
        .list("statuses")
        .into_iter()
        .filter(|s| s.reference("boardId") == Some(id) && s.archived_at.is_none())
        .collect::<Vec<_>>();
    statuses.sort_by_key(|s| s.data["position"].as_i64().unwrap_or(0));
    let mut columns = Vec::new();
    for status in statuses {
        let mut query = c.clone();
        query.operation = "listTasks".into();
        query.query.remove("limitPerColumn");
        query.query.insert("limit".into(), c.q("limitPerColumn"));
        query.query.insert("statusId".into(), json!(status.id));
        query.query.insert("rootOnly".into(), json!(true));
        query.query.insert("archived".into(), json!(false));
        query.query.insert("sortBy".into(), json!("position"));
        let mut column = list(records, &query)?;
        column["status"] = resource(records, "statuses", status.id)?;
        column["tasks"] = column["items"].take();
        column.as_object_mut().unwrap().remove("items");
        columns.push(column);
    }
    Ok(json!({"boardId":id,"columns":columns}))
}
fn resume(records: &Records, c: &Command) -> Result<Value> {
    let id = c.id("agentId")?;
    let mut contexts = Vec::new();
    let agent = resource(records, "agents", id)?;
    for (role, key) in [
        ("leader", "leaderTeamId"),
        ("collaborator", "collaboratorTeamId"),
    ] {
        if !agent["bindings"][key].is_null() {
            let team = records.get("teams", value_id(&agent["bindings"][key])?)?;
            contexts.push(json!({"teamId":team.id,"role":role,"name":team.data["name"],"purpose":team.data["purpose"],"context":team.data["context"]}));
        }
    }
    let mut ids = BTreeSet::new();
    if let Some(values) = c.q("taskIds").as_array() {
        for value in values {
            let id = value_id(value)?;
            if !ids.insert(id) {
                return Err(Failure::invalid("Duplicate taskIds"));
            }
            records.get("tasks", id)?;
        }
    }
    if ids.len() > 20 {
        return Err(Failure::invalid("At most 20 taskIds"));
    }
    Ok(
        json!({"agent":agent,"teamContexts":contexts,"activityIndexPath":format!("/api/v1/agents/{id}/activities"),"chatReferencesPath":format!("/api/v1/agents/{id}/chat-references"),"taskIds":ids,"generatedAt":Utc::now(),"notice":"Stored context only; no session is started or monitored."}),
    )
}
fn activities(records: &Records, c: &Command) -> Result<Value> {
    if c.query.contains_key("statusId") && !c.query.contains_key("boardId") {
        return Err(Failure::invalid("statusId requires boardId"));
    }
    let id = c.id("agentId")?;
    let relation = c.q("relation");
    let mut items = Vec::new();
    for task in records.list("tasks") {
        let authored = task.reference("authorAgentId") == Some(id);
        let executing = task.reference("executorAgentId") == Some(id);
        let latest = records
            .list("execution_summaries")
            .into_iter()
            .filter(|s| {
                s.reference("taskId") == Some(task.id) && s.reference("actorId") == Some(id)
            })
            .max_by_key(|s| (s.created_at, s.id));
        if !match relation.as_str().unwrap_or("any") {
            "authored" => authored,
            "executing" => executing,
            "worked" => latest.is_some(),
            _ => authored || executing || latest.is_some(),
        } {
            continue;
        }
        let mut item = task.value();
        item["_archived"] = json!(hierarchy::archived(records, task.id)?);
        item["taskId"] = json!(task.id);
        item["isCurrentExecutor"] = json!(executing);
        item["lastWorkedAt"] = json!(latest.map(|s| s.created_at));
        item["latestOwnSummaryId"] = json!(latest.map(|s| s.id));
        item["taskUpdatedAt"] = json!(task.updated_at);
        item["taskPath"] = json!(format!("/api/v1/tasks/{}", task.id));
        item["summariesPath"] = json!(format!(
            "/api/v1/tasks/{}/execution-summaries?actorId={id}",
            task.id
        ));
        items.push(item);
    }
    page(items, c, "taskId")
}
