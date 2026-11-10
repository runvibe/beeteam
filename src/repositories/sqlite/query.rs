//! Parameterized SQLite selection, filtering, ordering and pagination.
use super::super::records::Records;
use super::reads;
use crate::dto::backend::{Command, Failure, Result};
use serde_json::Value;
use sqlx::{QueryBuilder, Row, Sqlite, Transaction};

use super::super::records::Selection;

fn table(c: &Command) -> Result<&'static str> {
    Ok(match c.operation.as_str() {
        "listTaskExecutions" => "task_executions",
        "listTaskExecutionIntervals" | "listOpenExecutionIntervals" => "task_execution_intervals",
        "listTaskExecutionTrackingEvents" => "task_execution_tracking_events",
        "listTaskExecutionIntervalRevisions" => "task_execution_interval_revisions",
        "listAgents" | "listAvailableSessionAgents" => "agents",
        "listTeams" => "teams",
        "listBoards" => "boards",
        "listStatuses" => "statuses",
        "listTasks" | "listAllTasks" | "listAgentActivities" => "tasks",
        "listPlans" | "listPlanRevisions" => "plan_revisions",
        "listComments" => "comments",
        "listAttachments" => "attachments",
        "listExecutionSummarys" => "execution_summaries",
        "getTimeline" | "getTimelinePoints" => "events",
        "listChatReferences" => "chat_references",
        "listAgentSessionBindings" => "agent_session_bindings",
        "listTaskSessionDeliveries" | "listSessionDeliveryWork" => "session_deliveries",
        "listTeamMembers" => "agents",
        _ => return Err(Failure::missing()),
    })
}

// Derived fields are read-model projections. Domain execution/approval rules stay in services.
fn projection(table: &str, c: &Command) -> String {
    let base = "json_set(r.data,'$.id',r.id,'$.version',r.version,'$.createdAt',r.created_at,'$.updatedAt',r.updated_at,'$.archivedAt',r.archived_at,'$.deletedAt',r.deleted_at)";
    match c.operation.as_str() {
        "getTimelinePoints" => "json_object('id',r.id,'taskId',r.task_id,'type',r.data->>'type','occurredAt',r.data->>'occurredAt','sequence',r.data->>'sequence','actorId',r.data->>'actorId')".into(),
        "listTeamMembers" => "json_object('agentId',r.id,'name',r.data->>'name','role',member.role,'agentArchivedAt',r.archived_at)".into(),
        "listAgentActivities" => format!("json_set({base},'$._archived',json(CASE WHEN {} THEN 'true' ELSE 'false' END),'$.taskId',r.id,'$.isCurrentExecutor',json(CASE WHEN r.executor_agent_id=actor.id THEN 'true' ELSE 'false' END),'$.lastWorkedAt', (SELECT created_at FROM execution_summaries WHERE task_id=r.id AND deleted_at IS NULL AND data->>'actorId'=actor.id ORDER BY created_at DESC,id DESC LIMIT 1),'$.latestOwnSummaryId', (SELECT id FROM execution_summaries WHERE task_id=r.id AND deleted_at IS NULL AND data->>'actorId'=actor.id ORDER BY created_at DESC,id DESC LIMIT 1),'$.taskUpdatedAt',r.updated_at,'$._worked',json(CASE WHEN EXISTS(SELECT 1 FROM execution_summaries WHERE task_id=r.id AND deleted_at IS NULL AND data->>'actorId'=actor.id) THEN 'true' ELSE 'false' END),'$._authored',json(CASE WHEN r.author_agent_id=actor.id THEN 'true' ELSE 'false' END))", archived()),
        _ if table=="tasks" => format!("json_set({base},'$._archived',json(CASE WHEN {} THEN 'true' ELSE 'false' END))",archived()),
        _ if table=="agents" => format!("json_set({base},'$.bindings',json_object('leaderTeamId',(SELECT id FROM teams WHERE leader_id=r.id AND deleted_at IS NULL),'workerTeamId',(SELECT team_id FROM memberships WHERE agent_id=r.id AND deleted_at IS NULL)))"),
        _ if table=="teams" => format!("json_set({base},'$.workerCount',(SELECT count(*) FROM memberships WHERE team_id=r.id AND deleted_at IS NULL))"),
        _ => base.into(),
    }
}

fn archived() -> &'static str {
    "EXISTS(WITH RECURSIVE a AS (SELECT id,parent_id,board_id,archived_at FROM tasks WHERE id=r.id UNION SELECT t.id,t.parent_id,t.board_id,t.archived_at FROM tasks t JOIN a ON t.id=a.parent_id WHERE t.deleted_at IS NULL) SELECT 1 FROM a JOIN boards b ON b.id=a.board_id WHERE a.archived_at IS NOT NULL OR b.archived_at IS NOT NULL)"
}

fn base(c: &Command, table: &'static str) -> Result<QueryBuilder<Sqlite>> {
    let mut q = QueryBuilder::new("WITH source AS (SELECT ");
    q.push(projection(table, c))
        .push(" AS value FROM ")
        .push(table)
        .push(" r ");
    if c.operation == "listTeamMembers" {
        q.push("JOIN (SELECT leader_id AS id,'leader' AS role FROM teams WHERE id=").push_bind(c.id("teamId")?.to_string())
            .push(" UNION ALL SELECT agent_id,'worker' FROM memberships WHERE deleted_at IS NULL AND team_id=").push_bind(c.id("teamId")?.to_string())
            .push(") member ON member.id=r.id ");
    }
    if c.operation == "listAgentActivities" {
        q.push("CROSS JOIN (SELECT ")
            .push_bind(c.id("agentId")?.to_string())
            .push(" AS id) actor ");
    }
    q.push("WHERE ");
    q.push(if table == "attachments" && c.q("includeRemoved") == true {
        "true"
    } else {
        "r.deleted_at IS NULL"
    });
    if c.operation == "listOpenExecutionIntervals" { q.push(" AND r.state='open'"); }
    if c.operation != "listAgentActivities" && c.operation != "listTeamMembers" {
        for key in ["boardId", "taskId", "agentId", "planId", "intervalId"] {
            if let Some(id) = c.params.get(key) {
                if key == "taskId" && table == "events" && c.q("includeChildren") == true {
                    q.push(" AND r.task_id IN (WITH RECURSIVE tree AS (SELECT id FROM tasks WHERE id=").push_bind(c.id(key)?.to_string())
                        .push(" UNION SELECT t.id FROM tasks t JOIN tree ON t.parent_id=tree.id WHERE t.deleted_at IS NULL) SELECT id FROM tree)");
                } else {
                    q.push(" AND r.data->>")
                        .push_bind(key.to_string())
                        .push("=")
                        .push_bind(id.clone());
                }
            }
        }
    }
    if c.operation == "listPlans" {
        q.push(" AND NOT EXISTS(SELECT 1 FROM plan_revisions newer WHERE newer.plan_id=r.plan_id AND newer.deleted_at IS NULL AND CAST(newer.data->>'revision' AS INTEGER) > CAST(r.data->>'revision' AS INTEGER))");
    }
    if table == "teams" {
        if let Some(id) = c.query.get("workerId") {
            q.push(" AND EXISTS(SELECT 1 FROM memberships WHERE team_id=r.id AND deleted_at IS NULL AND data->'agentId'=").push_bind(id.clone()).push(")");
        }
    }
    q.push("), filtered AS (SELECT value FROM source WHERE true");
    filters(&mut q, c)?;
    q.push(") ");
    Ok(q)
}

fn field(q: &mut QueryBuilder<Sqlite>, key: &str, text: bool) {
    q.push(if text { "value->>" } else { "value->" })
        .push_bind(key.to_owned());
}
fn filters(q: &mut QueryBuilder<Sqlite>, c: &Command) -> Result<()> {
    if c.operation == "listSessionDeliveryWork" {
        q.push(" AND value->>'state' IN (SELECT value FROM json_each(").push_bind(c.q("states").to_string()).push(")) AND (value->'destination'->>'installationId'=").push_bind(c.q("installationId").as_str().unwrap_or("").to_owned())
            .push(" OR (value->>'bindingId' IS NULL AND EXISTS(SELECT 1 FROM agent_session_bindings b WHERE b.agent_id=(value->>'targetAgentId') AND b.deleted_at IS NULL AND b.data->>'endedAt' IS NULL AND b.data->>'installationId'=").push_bind(c.q("installationId").as_str().unwrap_or("").to_owned()).push(")))");
        return Ok(());
    }
    if c.operation == "listAvailableSessionAgents" {
        q.push(" AND value->>'archivedAt' IS NULL AND NOT EXISTS(SELECT 1 FROM agent_session_bindings b WHERE b.agent_id=(value->>'id') AND b.deleted_at IS NULL AND b.data->>'endedAt' IS NULL)");
    }
    if c.operation == "listAgentActivities" {
        q.push(" AND (");
        q.push(match c.q("relation").as_str().unwrap_or("any") {
            "authored" => "(value->>'_authored')",
            "executing" => "(value->>'isCurrentExecutor')",
            "worked" => "(value->>'_worked')",
            _ => "((value->>'_authored') OR (value->>'isCurrentExecutor') OR (value->>'_worked'))",
        })
        .push(")");
    }
    if c.operation == "listAgents"
        && (c.query.contains_key("teamId") || c.query.contains_key("role"))
    {
        let role = c.q("role");
        let fields: &[&str] = match role.as_str() {
            Some("leader") => &["leaderTeamId"],
            Some("worker") => &["workerTeamId"],
            _ => &["leaderTeamId", "workerTeamId"],
        };
        q.push(" AND (");
        for (i, f) in fields.iter().enumerate() {
            if i > 0 {
                q.push(" OR ");
            }
            q.push("value->'bindings'->").push_bind(f.to_string());
            if let Some(team) = c.query.get("teamId") {
                q.push("=").push_bind(team.clone());
            } else {
                q.push(" <> 'null'");
            }
        }
        q.push(")");
    }
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
                | "relation"
                | "workerId"
        ) || (c.operation == "listAgents" && matches!(key.as_str(), "role" | "teamId"))
        {
            continue;
        }
        if key == "includeArchived" {
            if *expected == false {
                q.push(" AND value->>'archivedAt' IS NULL");
            }
            continue;
        }
        if key == "rootOnly" {
            if *expected == true {
                q.push(" AND value->>'parentId' IS NULL");
            }
            continue;
        }
        q.push(" AND ");
        match key.as_str() {
            "archived" => {
                q.push("COALESCE(value->>'_archived', value->>'archivedAt' IS NOT NULL)=")
                    .push_bind(expected.as_bool().unwrap_or(false));
            }
            "system" => {
                q.push("(value->>'systemKey' IS NOT NULL)=")
                    .push_bind(expected.as_bool().unwrap_or(false));
            }
            "blocked" => {
                q.push("value->'block'->'blocked'=")
                    .push_bind(expected.clone());
            }
            "types" => {
                q.push("EXISTS(SELECT 1 FROM json_each(")
                    .push_bind(expected.to_string())
                    .push(") e WHERE e.value=source.value->>'type')");
            }
            "text" if c.operation == "listComments" => {
                // Literal substring: %, _ and backslash never become SQL wildcards.
                q.push("instr(COALESCE(");
                field(q, "body", true);
                q.push(",''),")
                    .push_bind(expected.as_str().unwrap_or("").to_owned())
                    .push(")>0");
            }
            "name" | "title" | "label" | "fileName" => {
                q.push("COALESCE(");
                field(
                    q,
                    if key == "fileName" {
                        "originalName"
                    } else {
                        key
                    },
                    true,
                );
                q.push(",'') REGEXP ").push_bind(format!(
                    "(?i){}",
                    regex::escape(expected.as_str().unwrap_or(""))
                ));
            }
            "mediaType" => {
                q.push("(");
                for (index, mime) in expected.as_str().unwrap_or("").split(',').enumerate() {
                    if index > 0 { q.push(" OR "); }
                    field(q, key, true);
                    q.push(" COLLATE beeteam_nocase = ").push_bind(mime.trim().to_owned());
                }
                q.push(")");
            }
            _ if key.ends_with("From") || key.ends_with("Before") => {
                let prefix = key.trim_end_matches("From").trim_end_matches("Before");
                let name = if prefix == "updated" && c.operation == "listAgentActivities" {
                    "taskUpdatedAt".into()
                } else {
                    format!("{prefix}At")
                };
                // Fixed nanosecond UTC storage preserves precise, offset-independent ranges.
                let value = chrono::DateTime::parse_from_rfc3339(expected.as_str().unwrap_or(""))
                    .map_err(|_| Failure::invalid("Invalid timestamp filter"))?
                    .with_timezone(&chrono::Utc)
                    .to_rfc3339_opts(chrono::SecondsFormat::Nanos, true);
                field(q, &name, true);
                q.push(if key.ends_with("From") { ">=" } else { "<" })
                    .push_bind(value);
            }
            _ => {
                q.push("COALESCE(");
                field(q, key, false);
                q.push(",'null')=").push_bind(expected.clone());
            }
        }
    }
    Ok(())
}

pub(super) async fn select(tx: &mut Transaction<'_, Sqlite>, c: &Command) -> Result<Selection> {
    if c.operation == "getAgentLatestActivity" { return super::super::agent_activity::sqlite(tx,c).await; }
    if c.operation=="getTaskExecutionIntervalUsage" { return crate::repositories::tracking::sqlite::select(tx,c).await; }
    if matches!(c.operation.as_str(), "getTaskUsage" | "listTaskUsageDimensions") {
        return crate::repositories::usage::sqlite::select(tx,c).await;
    }
    if c.operation == "listTaskParticipants" {
        return super::super::participants::sqlite(tx, c).await;
    }
    if c.operation == "getTaskOverview" {
        return super::super::overview::sqlite::select(tx, c).await;
    }
    let table = table(c)?;
    let mut count = base(c, table)?;
    count.push("SELECT count(*) FROM filtered");
    let total: i64 = count.build_query_scalar().fetch_one(&mut **tx).await?;
    let offset = c.q("offset").as_u64().unwrap_or(0) as usize;
    let limit = c.q("limit").as_u64().unwrap_or(50) as usize;
    let mut q = base(c, table)?;
    q.push("SELECT value FROM filtered ORDER BY ");
    let sort = c.q("sortBy");
    let sort = sort.as_str().unwrap_or("createdAt");
    let descending = c.q("sortOrder") == "desc";
    if matches!(
        sort,
        "position"
            | "revision"
            | "sequence"
            | "progress"
            | "version"
            | "workerCount"
            | "sizeBytes"
    ) {
        q.push("(");
        field(&mut q, sort, true);
        q.push(")");
    } else {
        q.push("COALESCE(");
        field(&mut q, sort, true);
        q.push(",'') COLLATE BINARY");
    }
    q.push(if descending { " DESC" } else { " ASC" }).push(", ");
    field(
        &mut q,
        if c.operation == "listTeamMembers" {
            "agentId"
        } else {
            "id"
        },
        true,
    );
    q.push(if descending { " DESC" } else { " ASC" })
        .push(" LIMIT ")
        .push_bind(limit as i64)
        .push(" OFFSET ")
        .push_bind(offset as i64);
    let rows = q.build().fetch_all(&mut **tx).await?;
    let mut items = Vec::new();
    let mut records = Records::default();
    for row in rows {
        items.push(row.get::<Value, _>("value"));
    }
    if !matches!(c.operation.as_str(), "listTeamMembers" | "getTimelinePoints") {
        let ids = items
            .iter()
            .map(|value| crate::dto::backend::value_id(&value["id"]))
            .collect::<Result<Vec<_>>>()?;
        if !ids.is_empty() {
            let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
                "SELECT * FROM {table} WHERE id IN (SELECT value FROM json_each($1))"
            )))
            .bind(serde_json::json!(ids).to_string())
            .fetch_all(&mut **tx)
            .await?;
            for row in rows {
                records.insert(reads::record(table, &row));
            }
            for item in &mut items {
                let id = crate::dto::backend::value_id(&item["id"])?;
                let record = records
                    .rows
                    .get(&(table, id))
                    .ok_or_else(Failure::missing)?;
                let metadata = record.value();
                for key in ["createdAt", "updatedAt", "archivedAt", "deletedAt"] {
                    item[key] = metadata[key].clone();
                }
                if c.operation == "listAgentActivities" {
                    item["taskUpdatedAt"] = metadata["updatedAt"].clone();
                }
            }
        }
    }
    reads::hydrate(tx, &mut records).await?;
    Ok(Selection {
        items,
        total: total as usize,
        offset,
        limit,
        records,
        table,
    })
}
