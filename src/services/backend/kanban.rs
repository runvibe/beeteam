use super::*;
use crate::{
    dto::backend::*,
    repositories::{
        contracts::UnitOfWork,
        records::{Record, Records},
    },
};
use chrono::Utc;
use serde_json::{json, Value};
use uuid::Uuid;

pub(super) async fn run(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    match c.operation.as_str() {
        "createBoard" | "updateBoard" | "createStatus" | "updateStatus" | "orderStatuses" => {
            board(unit, c).await
        }
        "createTask" => create_task(unit, c).await,
        _ => mutate_task(unit, c).await,
    }
}
async fn board(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let b = &c.body;
    if c.operation == "createBoard" {
        active(&unit.records, "teams", body_id(b, "teamId")?)?;
        let mut data = defaults(b, &["description"]);
        data["createdBy"] = c.actor()?.value();
        data["autonomyMode"] = b.get("autonomyMode").cloned().unwrap_or(json!("manual"));
        data["lastManagementChange"] = Value::Null;
        data.as_object_mut().unwrap().remove("statuses");
        let id = unit.records.insert(Record::new("boards", data));
        let statuses = b["statuses"].as_array().cloned().unwrap_or_else(|| {
            [
                "Backlog",
                "A fazer",
                "Em andamento",
                "Em revisão",
                "Concluída",
            ]
            .iter()
            .enumerate()
            .map(|(i, name)| json!({"name":name,"isDone":i==4}))
            .collect()
        });
        for (position, status) in statuses.iter().enumerate() {
            unit.records.insert(Record::new("statuses",json!({"boardId":id,"name":status["name"],"isDone":status.get("isDone").cloned().unwrap_or(json!(false)),"position":position})));
        }
        validate_statuses(&unit.records, id)?;
        let mut result = outcome(&unit.records, "boards", id, true)?;
        result.data["statuses"] = json!(unit
            .records
            .list("statuses")
            .iter()
            .filter(|s| s.reference("boardId") == Some(id))
            .map(|s| s.value())
            .collect::<Vec<_>>());
        return Ok(result);
    }
    let id = c.id("boardId")?;
    if c.operation == "updateBoard" {
        let old = unit.records.get("boards", id)?.clone();
        check_version(&old, c.expected_version)?;
        if old.archived_at.is_some() && b["archived"] != false {
            return Err(Failure::new(
                "archived_resource",
                "Restore board before editing",
            ));
        }
        if let Some(team) = b.get("teamId") {
            active(&unit.records, "teams", value_id(team)?)?;
            if *team != old.data["teamId"] {
                let event = Record::new(
                    "board_events",
                    json!({"boardId":id,"type":"board.management_changed","previousTeamId":old.data["teamId"],"teamId":team,"actor":c.actor()?.value(),"occurredAt":Utc::now()}),
                );
                unit.records.get_mut("boards", id)?.data["lastManagementChange"] = event.value();
                unit.records.insert(event);
            }
        }
        patch(
            unit.records.get_mut("boards", id)?,
            b,
            &["name", "description", "autonomyMode", "teamId"],
        );
        if b.get("autonomyMode")
            .is_some_and(|mode| *mode != old.data["autonomyMode"])
        {
            for task in unit.records.rows.values_mut().filter(|r| {
                r.table == "tasks"
                    && r.deleted_at.is_none()
                    && r.reference("originBoardId") == Some(id)
            }) {
                task.touch();
            }
        }
        return outcome(&unit.records, "boards", id, false);
    }
    active(&unit.records, "boards", id)?;
    match c.operation.as_str() {
        "createStatus" => {
            let position = unit
                .records
                .list("statuses")
                .iter()
                .filter(|s| s.reference("boardId") == Some(id))
                .map(|s| s.data["position"].as_i64().unwrap_or(0))
                .max()
                .unwrap_or(-1)
                + 1;
            let status=unit.records.insert(Record::new("statuses",json!({"boardId":id,"name":b["name"],"isDone":b.get("isDone").cloned().unwrap_or(json!(false)),"position":position})));
            validate_statuses(&unit.records, id)?;
            unit.records.get_mut("boards", id)?.touch();
            outcome(&unit.records, "statuses", status, true)
        }
        "updateStatus" => {
            let sid = c.id("statusId")?;
            let old = unit.records.get("statuses", sid)?.clone();
            if old.reference("boardId") != Some(id) {
                return Err(Failure::missing());
            }
            check_version(&old, c.expected_version)?;
            if (b["archived"] == true || b.get("isDone").is_some_and(|v| *v != old.data["isDone"]))
                && unit
                    .records
                    .list("tasks")
                    .iter()
                    .any(|t| t.reference("statusId") == Some(sid))
            {
                return Err(Failure::new(
                    "status_in_use",
                    "Status is referenced by tasks",
                ));
            }
            patch(
                unit.records.get_mut("statuses", sid)?,
                b,
                &["name", "isDone"],
            );
            validate_statuses(&unit.records, id)?;
            unit.records.get_mut("boards", id)?.touch();
            outcome(&unit.records, "statuses", sid, false)
        }
        "orderStatuses" => {
            check_version(unit.records.get("boards", id)?, c.expected_version)?;
            let requested = b["statusIds"]
                .as_array()
                .unwrap()
                .iter()
                .map(value_id)
                .collect::<Result<Vec<_>>>()?;
            let active = unit
                .records
                .list("statuses")
                .iter()
                .filter(|s| s.reference("boardId") == Some(id) && s.archived_at.is_none())
                .map(|s| s.id)
                .collect::<std::collections::BTreeSet<_>>();
            if requested.len() != active.len()
                || requested
                    .iter()
                    .copied()
                    .collect::<std::collections::BTreeSet<_>>()
                    != active
            {
                return Err(Failure::invalid("Include every active status exactly once"));
            }
            for (position, sid) in requested.iter().enumerate() {
                let status = unit.records.get_mut("statuses", *sid)?;
                status.data["position"] = json!(position);
                status.touch();
            }
            let board = unit.records.get_mut("boards", id)?;
            board.touch();
            let version = board.version;
            let mut result = Outcome::data(
                json!({"items":requested.iter().map(|sid|unit.records.get("statuses",*sid).unwrap().value()).collect::<Vec<_>>(),"boardVersion":version}),
            );
            result.version = Some(version);
            Ok(result)
        }
        _ => Err(Failure::missing()),
    }
}
fn validate_statuses(records: &Records, board: Uuid) -> Result<()> {
    let statuses = records
        .list("statuses")
        .into_iter()
        .filter(|s| s.reference("boardId") == Some(board) && s.archived_at.is_none())
        .collect::<Vec<_>>();
    if statuses.len() > 50 || !statuses.iter().any(|s| s.data["isDone"] == false) {
        return Err(Failure::new(
            "invalid_status_set",
            "Keep 1..50 active statuses and at least one non-final status",
        ));
    }
    let mut names = std::collections::BTreeSet::new();
    for s in statuses {
        let name = s.data["name"].as_str().unwrap().trim().to_lowercase();
        if name.is_empty() || !names.insert(name) {
            return Err(Failure::new(
                "duplicate_status",
                "Active status names must be unique",
            ));
        }
    }
    Ok(())
}
async fn create_task(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let board = c.id("boardId")?;
    active(&unit.records, "boards", board)?;
    let b = &c.body;
    active(&unit.records, "agents", body_id(b, "authorAgentId")?)?;
    active(&unit.records, "agents", body_id(b, "executorAgentId")?)?;
    let status = if let Some(id) = b.get("statusId") {
        value_id(id)?
    } else {
        unit.records
            .list("statuses")
            .into_iter()
            .filter(|s| {
                s.reference("boardId") == Some(board)
                    && s.archived_at.is_none()
                    && s.data["isDone"] == false
            })
            .min_by_key(|s| s.data["position"].as_i64())
            .ok_or_else(Failure::missing)?
            .id
    };
    validate_status(&unit.records, board, status)?;
    if unit.records.get("statuses", status)?.data["isDone"] == true {
        return Err(Failure::new(
            "summary_required",
            "Create tasks in non-final status",
        ));
    }
    let parent = b
        .get("parentId")
        .filter(|v| !v.is_null())
        .map(value_id)
        .transpose()?;
    let mut data = defaults(b, &["description", "specification"]);
    data.as_object_mut().unwrap().remove("coordinationContext");
    data["boardId"] = json!(board);
    data["statusId"] = json!(status);
    data["parentId"] = json!(parent);
    data["autonomyMode"] = b.get("autonomyMode").cloned().unwrap_or(json!("manual"));
    data["currentSummary"] = json!("");
    data["progress"] = json!({"percent":0,"note":""});
    data["block"] = json!({"blocked":false,"reason":null});
    data["latestExecutionSummaryId"] = Value::Null;
    data["slug"] = json!(
        unit.allocate_slug("tasks", data["title"].as_str().unwrap())
            .await?
    );
    let mut task = Record::new("tasks", data);
    let id = task.id;
    if let Some(parent) = parent {
        hierarchy::writable(&unit.records, parent, false)?;
        let p = unit.records.get("tasks", parent)?;
        check_version(p, c.expected_version)?;
        task.data["rootTaskId"] = p.data["rootTaskId"].clone();
        task.data["originBoardId"] = p.data["originBoardId"].clone();
        unit.records.get_mut("tasks", parent)?.touch();
    } else {
        task.data["rootTaskId"] = json!(id);
        task.data["originBoardId"] = json!(board);
    }
    task.data["position"] = json!(format!("{:020}", unit.records.list("tasks").len() + 1));
    unit.records.insert(task);
    let context = hierarchy::context(&unit.records, id)?;
    coordination(b, context["effectiveMode"].as_str().unwrap())?;
    event(unit,c,id,if parent.is_some(){"subtask.created"}else{"task.created"},json!({"coordinationContext":b["coordinationContext"],"parentId":parent,"authorAgentId":b["authorAgentId"],"executorAgentId":b["executorAgentId"]})).await?;
    outcome(&unit.records, "tasks", id, true)
}
fn validate_status(records: &Records, board: Uuid, status: Uuid) -> Result<()> {
    if active(records, "statuses", status)?.reference("boardId") != Some(board) {
        return Err(Failure::missing());
    }
    Ok(())
}
async fn mutate_task(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let id = c.id("taskId")?;
    let old = unit.records.get("tasks", id)?.clone();
    check_version(&old, c.expected_version)?;
    hierarchy::writable(
        &unit.records,
        id,
        c.operation == "archiveTask" && c.body["archived"] == false,
    )?;
    let b = &c.body;
    let board = old.reference("boardId").unwrap();
    let mut created: Option<(&str, Uuid)> = None;
    let (kind, audit) = match c.operation.as_str() {
        "updateTask" => {
            validate_current_summary(b, b.get("progress").is_some())?;
            patch(
                unit.records.get_mut("tasks", id)?,
                b,
                &[
                    "title",
                    "description",
                    "specification",
                    "progress",
                    "currentSummary",
                    "autonomyMode",
                ],
            );
            ("task.updated", json!({"previous":old.data,"changes":b}))
        }
        "assignTask" => {
            active(&unit.records, "agents", body_id(b, "executorAgentId")?)?;
            let context = hierarchy::context(&unit.records, id)?;
            coordination(b, context["effectiveMode"].as_str().unwrap())?;
            patch(unit.records.get_mut("tasks", id)?, b, &["executorAgentId"]);
            (
                "assignment.changed",
                json!({"previousExecutorAgentId":old.data["executorAgentId"],"executorAgentId":b["executorAgentId"],"coordinationContext":b["coordinationContext"]}),
            )
        }
        "moveTask" => {
            let status = body_id(b, "statusId")?;
            validate_status(&unit.records, board, status)?;
            if old.reference("statusId") != Some(status) {
                return Err(Failure::new(
                    "summary_required",
                    "Changing task status requires createExecutionSummary (POST execution-summaries) or close_activity with a complete execution summary; moveTask only reorders within the current status",
                ));
            }
            validate_current_summary(b, false)?;
            let before = b
                .get("beforeTaskId")
                .filter(|v| !v.is_null())
                .map(value_id)
                .transpose()?;
            let mut siblings = unit
                .records
                .list("tasks")
                .into_iter()
                .filter(|t| {
                    t.id != id
                        && t.reference("boardId") == Some(board)
                        && t.reference("statusId") == Some(status)
                        && t.reference("parentId") == old.reference("parentId")
                        && t.archived_at.is_none()
                })
                .map(|t| (t.data["position"].as_str().unwrap_or("").to_owned(), t.id))
                .collect::<Vec<_>>();
            siblings.sort();
            let index = if let Some(before) = before {
                siblings
                    .iter()
                    .position(|(_, i)| *i == before)
                    .ok_or_else(|| {
                        Failure::invalid(
                            "beforeTaskId must be a different active sibling in the target column",
                        )
                    })?
            } else {
                siblings.len()
            };
            siblings.insert(index, (String::new(), id));
            for (position, (_, tid)) in siblings.iter().enumerate() {
                let task = unit.records.get_mut("tasks", *tid)?;
                task.data["position"] = json!(format!("{position:020}"));
                if *tid != id {
                    task.touch();
                }
            }
            patch(
                unit.records.get_mut("tasks", id)?,
                b,
                &["statusId", "currentSummary"],
            );
            (
                "position.changed",
                json!({"previousStatusId":old.data["statusId"],"statusId":status,"beforeTaskId":before,"previousCurrentSummary":old.data["currentSummary"],"currentSummary":unit.records.get("tasks",id)?.data["currentSummary"]}),
            )
        }
        "blockTask" => {
            let task = unit.records.get_mut("tasks", id)?;
            task.data["block"] = b.clone();
            task.touch();
            (
                "block.changed",
                json!({"previous":old.data["block"],"block":b}),
            )
        }
        "archiveTask" => {
            patch(unit.records.get_mut("tasks", id)?, b, &[]);
            (
                if b["archived"] == true {
                    "task.archived"
                } else {
                    "task.restored"
                },
                json!({"archived":b["archived"]}),
            )
        }
        "createPlan" | "revisePlan" => {
            let (plan, title, revision, summary) = if c.operation == "createPlan" {
                let pid = unit.records.insert(Record::new(
                    "plans",
                    json!({"taskId":id,"title":b["title"]}),
                ));
                (pid, b["title"].clone(), 1, Value::Null)
            } else {
                let pid = c.id("planId")?;
                let plan = unit.records.get("plans", pid)?;
                if plan.reference("taskId") != Some(id) {
                    return Err(Failure::missing());
                }
                let current = unit
                    .records
                    .list("plan_revisions")
                    .into_iter()
                    .filter(|r| r.reference("planId") == Some(pid))
                    .map(|r| r.data["revision"].as_i64().unwrap())
                    .max()
                    .unwrap_or(0);
                if b["baseRevision"].as_i64() != Some(current) {
                    return Err(Failure::new("revision_conflict", "Plan revision changed"));
                }
                (
                    pid,
                    plan.data["title"].clone(),
                    current + 1,
                    b["changeSummary"].clone(),
                )
            };
            let rid=unit.records.insert(Record::new("plan_revisions",json!({"taskId":id,"planId":plan,"title":title,"revision":revision,"content":b["content"],"changeSummary":summary,"actorId":c.actor()?.id,"actorKind":c.actor()?.kind})));
            created = Some(("plan_revisions", rid));
            unit.records.get_mut("tasks", id)?.touch();
            (
                if revision == 1 {
                    "plan.created"
                } else {
                    "plan.revised"
                },
                json!({"planId":plan,"revisionId":rid,"revision":revision}),
            )
        }
        "createComment" => {
            let rid=unit.records.insert(Record::new("comments",json!({"taskId":id,"body":b["body"],"actorId":c.actor()?.id,"actorKind":c.actor()?.kind})));
            created = Some(("comments", rid));
            unit.records.get_mut("tasks", id)?.touch();
            ("comment.created", json!({"commentId":rid}))
        }
        "createExecutionSummary" => {
            validate_current_summary(b, true)?;
            let status = body_id(b, "statusId")?;
            validate_status(&unit.records, board, status)?;
            let context = hierarchy::context(&unit.records, id)?;
            if b["executionContext"]["rootTaskId"] != context["rootTaskId"]
                || b["executionContext"]["originBoardId"] != context["originBoardId"]
            {
                return Err(Failure::new(
                    "execution_context_mismatch",
                    "Execution context must match the root chain",
                ));
            }
            let done = unit.records.get("statuses", status)?.data["isDone"] == true;
            let completed = b["outcome"] == "completed";
            if done != completed {
                return Err(Failure::new(
                    "outcome_conflict",
                    "Outcome does not match final status",
                ));
            }
            if completed && old.data["block"]["blocked"] == true {
                return Err(Failure::new(
                    "task_blocked",
                    "Unblock task before completion",
                ));
            }
            if b["outcome"] == "blocked" && old.data["block"]["blocked"] != true {
                return Err(Failure::new("task_not_blocked", "Record the block first"));
            }
            for delivery in b["deliverables"].as_array().unwrap() {
                super::ra::validate_url(delivery["url"].as_str())?;
                if let Some(aid) = delivery.get("attachmentId") {
                    if unit
                        .records
                        .get("attachments", value_id(aid)?)?
                        .reference("taskId")
                        != Some(id)
                    {
                        return Err(Failure::missing());
                    }
                }
            }
            let mut data = b.clone();
            data["taskId"] = json!(id);
            data["actorId"] = json!(c.actor()?.id);
            data["actorKind"] = json!(c.actor()?.kind);
            data["reviewContext"] = b.get("reviewContext").cloned().unwrap_or(Value::Null);
            data["executionContext"] = context;
            data.as_object_mut().unwrap().remove("progress");
            data.as_object_mut().unwrap().remove("currentSummary");
            let status_record=unit.records.get("statuses",status)?;
            let status_observed=json!({"id":status,"name":status_record.data["name"],"isDone":done});
            data["statusObserved"]=status_observed.clone();
            data.as_object_mut().unwrap().remove("usageReport");
            let mut summary_record=Record::new("execution_summaries",data);
            crate::dto::usage::require_report(b)?;
            summary_record.data["usageReport"]=super::usage::report(&unit.records,id,summary_record.id,c.actor()?,status_observed,&b["usageReport"],None,b.get("executionTracking").is_some())?;
            super::tracking::apply(&mut unit.records,&mut summary_record,c)?;
            let sid=unit.records.insert(summary_record);
            let task = unit.records.get_mut("tasks", id)?;
            task.data["currentSummary"] = b["currentSummary"].clone();
            task.data["statusId"] = json!(status);
            task.data["latestExecutionSummaryId"] = json!(sid);
            if let Some(progress) = b.get("progress") {
                task.data["progress"] = progress.clone();
            }
            if completed {
                task.data["progress"]["percent"] = json!(100);
            }
            task.touch();
            created = Some(("execution_summaries", sid));
            (
                "execution.recorded",
                json!({"executionSummaryId":sid,"progress":unit.records.get("tasks",id)?.data["progress"],"previousStatusId":old.data["statusId"],"statusId":status,"previousCurrentSummary":old.data["currentSummary"],"currentSummary":b["currentSummary"]}),
            )
        }
        _ => return Err(Failure::missing()),
    };
    event(unit, c, id, kind, audit).await?;
    if let Some((table, rid)) = created {
        let mut result = outcome(&unit.records, table, rid, true)?;
        result.version = Some(unit.records.get("tasks", id)?.version);
        if table == "execution_summaries" {
            result.data = json!({"executionSummary":result.data,"task":queries::resource(&unit.records,"tasks",id)?});
        }
        Ok(result)
    } else {
        outcome(&unit.records, "tasks", id, false)
    }
}

fn validate_current_summary(body: &Value, required: bool) -> Result<()> {
    match body.get("currentSummary") {
        Some(Value::String(text)) if !text.trim().is_empty() && text.len() <= 16384 => Ok(()),
        None if !required => Ok(()),
        _ => Err(Failure::invalid("currentSummary must be a non-blank cumulative synthesis of at most 16384 UTF-8 bytes; required for work progress or status changes")),
    }
}
