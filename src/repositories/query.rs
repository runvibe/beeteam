//! Parameterized PostgreSQL selection, filtering, ordering and pagination.
use super::{reads, records::Records};
use crate::dto::backend::{Command, Failure, Result};
use serde_json::Value;
use sqlx::{Postgres, QueryBuilder, Row, Transaction};

use super::records::Selection;

fn table(c: &Command) -> Result<&'static str> {
    Ok(match c.operation.as_str() {
        "listAgents" => "agents",
        "listTeams" => "teams",
        "listBoards" => "boards",
        "listStatuses" => "statuses",
        "listTasks" | "listAllTasks" | "listAgentActivities" => "tasks",
        "listPlans" | "listPlanRevisions" => "plan_revisions",
        "listComments" => "comments",
        "listAttachments" => "attachments",
        "listExecutionSummarys" => "execution_summaries",
        "getTimeline" => "events",
        "listChatReferences" => "chat_references",
        "listTeamMembers" => "agents",
        _ => return Err(Failure::missing()),
    })
}

// Derived fields are read-model projections. Domain execution/approval rules stay in services.
fn projection(table: &str, c: &Command) -> String {
    let base = "r.data || jsonb_build_object('id',r.id,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'archivedAt',r.archived_at,'deletedAt',r.deleted_at)";
    match c.operation.as_str() {
        "listTeamMembers" => "jsonb_build_object('agentId',r.id,'name',r.data->'name','role',member.role,'agentArchivedAt',r.archived_at)".into(),
        "listAgentActivities" => format!("{base} || jsonb_build_object('_archived',{},'taskId',r.id,'isCurrentExecutor',r.executor_agent_id=actor.id,'lastWorkedAt',own.created_at,'latestOwnSummaryId',own.id,'taskUpdatedAt',r.updated_at,'_worked',own.id IS NOT NULL,'_authored',r.author_agent_id=actor.id)", archived()),
        _ if table=="tasks" => format!("{base} || jsonb_build_object('_archived',{})",archived()),
        _ if table=="agents" => format!("{base} || jsonb_build_object('bindings',jsonb_build_object('leaderTeamId',(SELECT id FROM teams WHERE leader_id=r.id AND deleted_at IS NULL),'collaboratorTeamId',(SELECT team_id FROM memberships WHERE agent_id=r.id AND deleted_at IS NULL)))"),
        _ if table=="teams" => format!("{base} || jsonb_build_object('collaboratorCount',(SELECT count(*) FROM memberships WHERE team_id=r.id AND deleted_at IS NULL))"),
        _ => base.into(),
    }
}
fn archived() -> &'static str {
    "EXISTS(WITH RECURSIVE a AS (SELECT id,parent_id,board_id,archived_at FROM tasks WHERE id=r.id UNION SELECT t.id,t.parent_id,t.board_id,t.archived_at FROM tasks t JOIN a ON t.id=a.parent_id WHERE t.deleted_at IS NULL) SELECT 1 FROM a JOIN boards b ON b.id=a.board_id WHERE a.archived_at IS NOT NULL OR b.archived_at IS NOT NULL)"
}

fn base(c: &Command, table: &'static str) -> Result<QueryBuilder<Postgres>> {
    let mut q = QueryBuilder::new("WITH source AS (SELECT ");
    q.push(projection(table, c))
        .push(" AS value FROM ")
        .push(table)
        .push(" r ");
    if c.operation == "listTeamMembers" {
        q.push("JOIN (SELECT leader_id AS id,'leader' AS role FROM teams WHERE id=").push_bind(c.id("teamId")?)
            .push(" UNION ALL SELECT agent_id,'collaborator' FROM memberships WHERE deleted_at IS NULL AND team_id=").push_bind(c.id("teamId")?)
            .push(") member ON member.id=r.id ");
    }
    if c.operation == "listAgentActivities" {
        q.push("CROSS JOIN (SELECT ").push_bind(c.id("agentId")?).push("::uuid AS id) actor LEFT JOIN LATERAL (SELECT id,created_at FROM execution_summaries WHERE task_id=r.id AND deleted_at IS NULL AND data->>'actorId'=actor.id::text ORDER BY created_at DESC,id DESC LIMIT 1) own ON true ");
    }
    q.push("WHERE ");
    q.push(if table == "attachments" && c.q("includeRemoved") == true {
        "true"
    } else {
        "r.deleted_at IS NULL"
    });
    if c.operation != "listAgentActivities" && c.operation != "listTeamMembers" {
        for key in ["boardId", "taskId", "agentId", "planId"] {
            if let Some(id) = c.params.get(key) {
                if key == "taskId" && table == "events" && c.q("includeChildren") == true {
                    q.push(" AND r.task_id IN (WITH RECURSIVE tree AS (SELECT id FROM tasks WHERE id=").push_bind(c.id(key)?)
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
        q.push(" AND NOT EXISTS(SELECT 1 FROM plan_revisions newer WHERE newer.plan_id=r.plan_id AND newer.deleted_at IS NULL AND (newer.data->>'revision')::bigint > (r.data->>'revision')::bigint)");
    }
    if table == "teams" {
        if let Some(id) = c.query.get("collaboratorId") {
            q.push(" AND EXISTS(SELECT 1 FROM memberships WHERE team_id=r.id AND deleted_at IS NULL AND data->'agentId'=").push_bind(id.clone()).push(")");
        }
    }
    q.push("), filtered AS (SELECT value FROM source WHERE true");
    filters(&mut q, c);
    q.push(") ");
    Ok(q)
}

fn field(q: &mut QueryBuilder<Postgres>, key: &str, text: bool) {
    q.push(if text { "value->>" } else { "value->" })
        .push_bind(key.to_owned());
}
fn filters(q: &mut QueryBuilder<Postgres>, c: &Command) {
    if c.operation == "listAgentActivities" {
        q.push(" AND (");
        q.push(match c.q("relation").as_str().unwrap_or("any") {
            "authored" => "(value->>'_authored')::boolean", "executing" => "(value->>'isCurrentExecutor')::boolean",
            "worked" => "(value->>'_worked')::boolean", _=>"((value->>'_authored')::boolean OR (value->>'isCurrentExecutor')::boolean OR (value->>'_worked')::boolean)",
        }).push(")");
    }
    if c.operation == "listAgents"
        && (c.query.contains_key("teamId") || c.query.contains_key("role"))
    {
        let role = c.q("role");
        let fields: &[&str] = match role.as_str() {
            Some("leader") => &["leaderTeamId"],
            Some("collaborator") => &["collaboratorTeamId"],
            _ => &["leaderTeamId", "collaboratorTeamId"],
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
                q.push(" <> 'null'::jsonb");
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
                | "taskIds"
                | "relation"
                | "collaboratorId"
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
                q.push(
                    "COALESCE((value->>'_archived')::boolean, value->>'archivedAt' IS NOT NULL)=",
                )
                .push_bind(expected.as_bool().unwrap_or(false));
            }
            "blocked" => {
                q.push("value->'block'->'blocked'=")
                    .push_bind(expected.clone());
            }
            "types" => {
                q.push_bind(expected.clone())
                    .push(" @> jsonb_build_array(value->'type')");
            }
            "name" | "title" | "label" | "fileName" => {
                q.push("strpos(lower(COALESCE(");
                field(
                    q,
                    if key == "fileName" {
                        "originalName"
                    } else {
                        key
                    },
                    true,
                );
                q.push(",'')), lower(")
                    .push_bind(expected.as_str().unwrap_or("").to_owned())
                    .push("))>0");
            }
            "mediaType" => {
                q.push("lower(");
                field(q, key, true);
                q.push(")=lower(")
                    .push_bind(expected.as_str().unwrap_or("").to_owned())
                    .push(")");
            }
            _ if key.ends_with("From") || key.ends_with("Before") => {
                let prefix = key.trim_end_matches("From").trim_end_matches("Before");
                let name = if prefix == "updated" && c.operation == "listAgentActivities" {
                    "taskUpdatedAt".into()
                } else {
                    format!("{prefix}At")
                };
                q.push("(");
                field(q, &name, true);
                q.push(")::timestamptz")
                    .push(if key.ends_with("From") { ">=" } else { "<" })
                    .push_bind(expected.as_str().unwrap_or("").to_owned())
                    .push("::timestamptz");
            }
            _ => {
                q.push("COALESCE(");
                field(q, key, false);
                q.push(",'null'::jsonb)=").push_bind(expected.clone());
            }
        }
    }
}

pub(super) async fn select(tx: &mut Transaction<'_, Postgres>, c: &Command) -> Result<Selection> {
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
            | "collaboratorCount"
            | "sizeBytes"
    ) {
        q.push("(");
        field(&mut q, sort, true);
        q.push(")::numeric");
    } else {
        q.push("COALESCE(");
        field(&mut q, sort, true);
        q.push(",'') COLLATE \"C\"");
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
    if c.operation != "listTeamMembers" {
        let ids = items
            .iter()
            .map(|value| crate::dto::backend::value_id(&value["id"]))
            .collect::<Result<Vec<_>>>()?;
        if !ids.is_empty() {
            let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
                "SELECT * FROM {table} WHERE id=ANY($1)"
            )))
            .bind(ids)
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
