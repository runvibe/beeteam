//! Bounded, snapshot-consistent integrated chat reads; identifiers are internal constants.
use crate::{
    dto::backend::{Command, Failure, Result},
    repositories::records::Records,
};
use sqlx::{Sqlite, Transaction};
pub(super) async fn context(tx: &mut Transaction<'_, Sqlite>, c: &Command) -> Result<Records> {
    let mut records = Records::default();
    for (key, table) in [
        ("agentId", "agents"),
        ("teamId", "teams"),
        ("chatId", "leader_chats"),
        ("turnId", "leader_chat_turns"),
        ("approvalId", "leader_chat_approvals"),
    ] {
        if let Some(id) = c
            .params
            .get(key)
            .cloned()
            .or_else(|| c.query.get(key).and_then(|v| v.as_str()).map(str::to_owned))
        {
            load(tx, &mut records, table, "id=$1", &id, 100).await?;
        }
    }
    let agent = c.params.get("agentId").cloned().or_else(|| {
        records
            .list("leader_chats")
            .first()
            .and_then(|r| r.data["leaderAgentId"].as_str())
            .map(str::to_owned)
    });
    if let Some(agent) = agent {
        load(tx, &mut records, "agents", "id=$1", &agent, 1).await?;
        load(
            tx,
            &mut records,
            "agent_session_bindings",
            "json_extract(data,'$.agentId')=$1 AND json_extract(data,'$.endedAt') IS NULL",
            &agent,
            1,
        )
        .await?;
    }
    let limit = c
        .query
        .get("limit")
        .and_then(|v| v.as_u64())
        .unwrap_or(50)
        .clamp(1, 100) as i64;
    match c.operation.as_str() {
        "integrated:runtime" => {
            if let Some(binding) = records
                .list("agent_session_bindings")
                .first()
                .map(|b| b.id.to_string())
            {
                load(tx,&mut records,"leader_chat_turns","json_extract(data,'$.bindingId')=$1 AND json_extract(data,'$.status') IN ('queued','running','waiting_approval','cancel_requested','uncertain')",&binding,1).await?;
                load(tx,&mut records,"session_deliveries","json_extract(data,'$.bindingId')=$1 AND json_extract(data,'$.state') IN ('dispatching','acknowledged','uncertain')",&binding,1).await?;
            }
        }
        "integrated:list" => {
            let team = c
                .query
                .get("teamId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| Failure::invalid("teamId required"))?;
            paged(
                tx,
                &mut records,
                "leader_chats",
                "json_extract(data,'$.teamId')",
                team,
                c.query
                    .get("cursor")
                    .and_then(|v| v.as_str())
                    .unwrap_or("ffffffff-ffff-ffff-ffff-ffffffffffff"),
                limit + 1,
                false,
            )
            .await?;
        }
        "integrated:snapshot" | "integrated:messages" | "integrated:events" => {
            let chat = c.params.get("chatId").ok_or_else(Failure::missing)?;
            records.get("leader_chats", c.id("chatId")?)?;
            if c.operation == "integrated:events" {
                paged(
                    tx,
                    &mut records,
                    "leader_chat_events",
                    "json_extract(data,'$.chatId')",
                    chat,
                    c.query
                        .get("after")
                        .and_then(|v| v.as_str())
                        .unwrap_or("00000000-0000-0000-0000-000000000000"),
                    100,
                    true,
                )
                .await?;
            } else {
                paged(
                    tx,
                    &mut records,
                    "leader_chat_messages",
                    "json_extract(data,'$.chatId')",
                    chat,
                    c.query
                        .get("cursor")
                        .and_then(|v| v.as_str())
                        .unwrap_or("ffffffff-ffff-ffff-ffff-ffffffffffff"),
                    limit + 1,
                    false,
                )
                .await?;
                if c.operation == "integrated:snapshot" {
                    let binding = records.get("leader_chats", c.id("chatId")?)?.data["bindingId"]
                        .as_str()
                        .ok_or_else(Failure::missing)?
                        .to_owned();
                    load(tx,&mut records,"leader_chat_turns","json_extract(data,'$.bindingId')=$1 AND json_extract(data,'$.status') IN ('queued','running','waiting_approval','cancel_requested','uncertain')",&binding,1).await?;
                    load(tx,&mut records,"leader_chat_approvals","json_extract(data,'$.chatId')=$1 AND json_extract(data,'$.status')='pending'",chat,100).await?;
                    load(
                        tx,
                        &mut records,
                        "leader_chat_tools",
                        "json_extract(data,'$.chatId')=$1",
                        chat,
                        100,
                    )
                    .await?;
                    load(
                        tx,
                        &mut records,
                        "leader_chat_events",
                        "json_extract(data,'$.chatId')=$1",
                        chat,
                        1,
                    )
                    .await?;
                }
            }
        }
        _ => {}
    }
    Ok(records)
}
async fn load(
    tx: &mut Transaction<'_, Sqlite>,
    records: &mut Records,
    table: &'static str,
    filter: &str,
    value: &str,
    limit: i64,
) -> Result<()> {
    let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
        "SELECT * FROM {table} WHERE deleted_at IS NULL AND {filter} ORDER BY id DESC LIMIT $2"
    )))
    .bind(value)
    .bind(limit)
    .fetch_all(&mut **tx)
    .await?;
    for row in rows {
        records.insert(super::reads::record(table, &row));
    }
    Ok(())
}
async fn paged(
    tx: &mut Transaction<'_, Sqlite>,
    records: &mut Records,
    table: &'static str,
    column: &str,
    owner: &str,
    cursor: &str,
    limit: i64,
    ascending: bool,
) -> Result<()> {
    let comparison = if ascending { ">" } else { "<" };
    let order = if ascending { "ASC" } else { "DESC" };
    let rows=sqlx::query(sqlx::AssertSqlSafe(format!("SELECT * FROM {table} WHERE deleted_at IS NULL AND {column}=$1 AND id {comparison} $2 ORDER BY id {order} LIMIT $3"))).bind(owner).bind(cursor).bind(limit).fetch_all(&mut **tx).await?;
    for row in rows {
        records.insert(super::reads::record(table, &row));
    }
    Ok(())
}
