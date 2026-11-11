//! Bounded reads inside the repository-owned snapshot.
use crate::{
    dto::backend::{Command, Result},
    repositories::records::Records,
};
use sqlx::{Postgres, Transaction};
pub(super) async fn context(tx: &mut Transaction<'_, Postgres>, c: &Command) -> Result<Records> {
    let mut r = Records::default();
    for (key, table) in [
        ("agentId", "agents"),
        ("teamId", "teams"),
        ("requestId", "managed_requests"),
        ("conversationId", "managed_conversations"),
    ] {
        if let Some(id) = c.params.get(key) {
            load(tx, &mut r, table, "CAST(id AS TEXT)=$1", id, "", 1, false).await?;
        }
    }
    let limit = c.q("limit").as_u64().unwrap_or(50).clamp(1, 100) as i64;
    let before = c
        .q("before")
        .as_str()
        .unwrap_or("ffffffff-ffff-ffff-ffff-ffffffffffff")
        .to_owned();
    match c.operation.as_str() {
        "managed:team-approvals" => {
            let rows = sqlx::query("SELECT a.* FROM managed_approvals a JOIN memberships m ON CAST(m.agent_id AS TEXT)=a.data->>'agentId' AND m.deleted_at IS NULL JOIN agents ag ON ag.id=m.agent_id AND ag.deleted_at IS NULL JOIN managed_requests q ON CAST(q.id AS TEXT)=a.data->>'requestId' AND q.deleted_at IS NULL WHERE a.deleted_at IS NULL AND a.data->>'state'='pending' AND CAST(m.team_id AS TEXT)=$1 AND CAST(a.id AS TEXT)<$2 ORDER BY a.id DESC LIMIT $3")
                .bind(c.id("teamId")?.to_string()).bind(&before).bind(limit + 1)
                .fetch_all(&mut **tx).await?;
            let mut agent_ids = Vec::new();
            let mut request_ids = Vec::new();
            for (i, row) in rows.iter().enumerate() {
                let approval = super::reads::record("managed_approvals", row);
                if i < limit as usize {
                    if let Some(id) = approval.reference("agentId") {
                        agent_ids.push(id.to_string());
                    }
                    if let Some(id) = approval.reference("requestId") {
                        request_ids.push(id.to_string());
                    }
                }
                r.insert(approval);
            }
            for (table, ids) in [("agents", agent_ids), ("managed_requests", request_ids)] {
                let sql = match table {
                    "agents" => "SELECT * FROM agents WHERE deleted_at IS NULL AND CAST(id AS TEXT)=ANY($1)",
                    _ => "SELECT * FROM managed_requests WHERE deleted_at IS NULL AND CAST(id AS TEXT)=ANY($1)",
                };
                for row in sqlx::query(sql).bind(ids).fetch_all(&mut **tx).await? {
                    r.insert(super::reads::record(table, &row));
                }
            }
        }
        "managed:work" => {
            load(
                tx,
                &mut r,
                "session_deliveries",
                "data->>'state'='managed_backpressure' AND EXISTS (SELECT 1 FROM agents a WHERE CAST(a.id AS TEXT)=session_deliveries.data->>'targetAgentId' AND a.data->>'managedInstallation'=$1) AND (SELECT COUNT(*) FROM managed_requests q WHERE q.deleted_at IS NULL AND q.data->>'agentId'=session_deliveries.data->>'targetAgentId' AND q.data->>'state' NOT IN ('completed','failed','cancelled'))<32",
                c.q("installation").as_str().unwrap_or(""),
                "",
                100,
                true,
            )
            .await?;
            load(
                tx,
                &mut r,
                "managed_requests",
                "data->>'state'='queued' AND EXISTS (SELECT 1 FROM managed_conversations c WHERE CAST(c.id AS TEXT)=managed_requests.data->>'conversationId' AND c.data->>'installationId'=$1) AND NOT EXISTS (SELECT 1 FROM managed_requests busy WHERE busy.deleted_at IS NULL AND busy.data->>'agentId'=managed_requests.data->>'agentId' AND busy.data->>'state' NOT IN ('queued','completed','failed','cancelled'))",
                c.q("installation").as_str().unwrap_or(""),
                "",
                100,
                true,
            )
            .await?;
        }
        "managed:requests" | "managed:conversations" => {
            let table = if c.operation == "managed:requests" {
                "managed_requests"
            } else {
                "managed_conversations"
            };
            load(
                tx,
                &mut r,
                table,
                "data->>'agentId'=$1",
                &c.id("agentId")?.to_string(),
                &before,
                limit + 1,
                false,
            )
            .await?;
        }
        "managed:sessions" => {
            let ascending = c.q("ascending").as_bool().unwrap_or(false);
            let (compare, order) = if ascending { (">", "ASC") } else { ("<", "DESC") };
            let list = |key: &str| -> Vec<String> {
                c.q(key)
                    .as_array()
                    .map(|v| v.iter().filter_map(|x| x.as_str().map(str::to_owned)).collect())
                    .unwrap_or_default()
            };
            let sql = format!("SELECT * FROM managed_conversations WHERE deleted_at IS NULL AND data->>'teamId' IS NOT NULL AND (cardinality($1::text[])=0 OR data->>'teamId'=ANY($1::text[])) AND (cardinality($2::text[])=0 OR data->>'agentId'=ANY($2::text[])) AND (NOT $3 OR data->>'boardId'=ANY($4::text[]) OR ($5 AND data->>'boardId' IS NULL)) AND ($6::timestamptz IS NULL OR (updated_at,id) {compare} ($6::timestamptz,$7::uuid)) ORDER BY updated_at {order}, id {order} LIMIT $8");
            let after = c
                .q("afterTime")
                .as_str()
                .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
                .map(|t| t.with_timezone(&chrono::Utc));
            for row in sqlx::query(sqlx::AssertSqlSafe(sql))
                .bind(list("teamIds"))
                .bind(list("agentIds"))
                .bind(c.q("boardFilter").as_bool().unwrap_or(false))
                .bind(list("boardIds"))
                .bind(c.q("noBoard").as_bool().unwrap_or(false))
                .bind(after)
                .bind(c.q("afterId").as_str().map(str::to_owned))
                .bind(limit + 1)
                .fetch_all(&mut **tx)
                .await?
            {
                r.insert(super::reads::record("managed_conversations", &row));
            }
        }
        "managed:messages" => {
            load(
                tx,
                &mut r,
                "managed_messages",
                "data->>'conversationId'=$1",
                &c.id("conversationId")?.to_string(),
                &before,
                limit + 1,
                false,
            )
            .await?;
        }
        "managed:snapshot" => {
            let id = c.id("requestId")?;
            let conversation = r
                .get("managed_requests", id)?
                .reference("conversationId")
                .unwrap();
            load(
                tx,
                &mut r,
                "managed_messages",
                "data->>'conversationId'=$1",
                &conversation.to_string(),
                &before,
                51,
                false,
            )
            .await?;
            load(
                tx,
                &mut r,
                "managed_approvals",
                "data->>'requestId'=$1 AND data->>'state'='pending'",
                &id.to_string(),
                "",
                100,
                false,
            )
            .await?;
            load(
                tx,
                &mut r,
                "managed_events",
                "data->>'requestId'=$1",
                &id.to_string(),
                "",
                1,
                false,
            )
            .await?;
        }
        "managed:events" => {
            let after = c
                .q("afterId")
                .as_str()
                .unwrap_or("00000000-0000-0000-0000-000000000000")
                .to_owned();
            load(
                tx,
                &mut r,
                "managed_events",
                "data->>'requestId'=$1",
                &c.id("requestId")?.to_string(),
                &after,
                100,
                true,
            )
            .await?;
        }
        _ => {}
    };
    Ok(r)
}
async fn load(
    tx: &mut Transaction<'_, Postgres>,
    r: &mut Records,
    table: &'static str,
    filter: &str,
    value: &str,
    cursor: &str,
    limit: i64,
    ascending: bool,
) -> Result<()> {
    let compare = if ascending { ">" } else { "<" };
    let order = if ascending { "ASC" } else { "DESC" };
    let rows=sqlx::query(sqlx::AssertSqlSafe(format!("SELECT * FROM {table} WHERE deleted_at IS NULL AND {filter} AND ($2='' OR CAST(id AS TEXT) {compare} $2) ORDER BY id {order} LIMIT $3"))).bind(value).bind(cursor).bind(limit).fetch_all(&mut **tx).await?;
    for row in rows {
        r.insert(super::reads::record(table, &row));
    }
    Ok(())
}
