use crate::{
    dto::data_transfer::Manifest,
    repositories::{records::TABLES, transfer::archive::ArchiveStore},
};
use anyhow::{ensure, Context, Result};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;
pub fn uuid(v: &Value) -> Result<Uuid> {
    let text = v.as_str().context("invalid_uuid")?;
    let id = Uuid::parse_str(text)?;
    ensure!(
        id.get_version_num() == 7 && id.to_string() == text,
        "invalid_uuid"
    );
    Ok(id)
}
pub fn timestamp(v: &Value) -> Result<Option<chrono::DateTime<chrono::Utc>>> {
    if v.is_null() {
        return Ok(None);
    }
    Ok(Some(
        chrono::DateTime::parse_from_rfc3339(v.as_str().context("invalid_timestamp")?)?
            .with_timezone(&chrono::Utc),
    ))
}
fn refs(table: &str) -> Vec<(&'static str, &'static str, bool)> {
    match table {
        "task_executions" => vec![("taskId","tasks",false),("agentId","agents",false),("startSummaryId","execution_summaries",false),("endSummaryId","execution_summaries",true)],
        "task_execution_intervals" => vec![("taskId","tasks",false),("executionId","task_executions",false),("startSummaryId","execution_summaries",false),("endSummaryId","execution_summaries",true)],
        "task_execution_interval_counters" | "task_execution_interval_revisions" => vec![("taskId","tasks",false),("intervalId","task_execution_intervals",false)],
        "task_execution_tracking_events" => vec![("taskId","tasks",false),("executionId","task_executions",false),("summaryId","execution_summaries",false),("intervalId","task_execution_intervals",true)],
        "teams" => vec![("leaderId", "agents", false)],
        "memberships" => vec![("teamId", "teams", false), ("agentId", "agents", false)],
        "boards" => vec![("teamId", "teams", false)],
        "statuses" => vec![("boardId", "boards", false)],
        "tasks" => vec![
            ("boardId", "boards", false),
            ("statusId", "statuses", false),
            ("parentId", "tasks", true),
            ("rootTaskId", "tasks", false),
            ("originBoardId", "boards", false),
            ("authorAgentId", "agents", false),
            ("executorAgentId", "agents", false),
        ],
        "plan_revisions" => vec![("taskId", "tasks", false), ("planId", "plans", false)],
        "plans" | "comments" | "events" | "execution_summaries" => vec![("taskId", "tasks", false)],
        "attachments" => vec![
            ("taskId", "tasks", false),
            ("contentId", "file_contents", false),
        ],
        "images" => vec![
            ("agentId", "agents", false),
            ("contentId", "file_contents", false),
        ],
        "chat_references" | "agent_session_bindings" => vec![("agentId", "agents", false)],
        "session_deliveries" => vec![("taskId","tasks",false),("commentId","comments",false),("targetAgentId","agents",false),("bindingId","agent_session_bindings",true),("originBindingId","agent_session_bindings",true),("requesterAgentId","agents",true),("replyCommentId","comments",true)],
        "board_events" => vec![("boardId", "boards", false)],
        _ => vec![],
    }
}
/// Bounded line reads; indexes contain only IDs/relationships, not full payloads or blobs.
pub fn inspect(store: &ArchiveStore, id: Uuid, manifest: &Manifest, driver: &str) -> Result<u64> {
    let mut ids = BTreeSet::new();
    let mut links = Vec::new();
    let mut tasks = BTreeMap::new();
    let mut status_boards = BTreeMap::new();
    let mut slugs = BTreeSet::new();
    let mut blobs = BTreeSet::new();
    let mut leaders = BTreeMap::new();
    let mut members = BTreeSet::new();
    let mut memberships = Vec::new();
    let mut precision = 0;
    let started = std::time::Instant::now();
    for table in crate::repositories::transfer::archive::groups() {
        for row in store.row_iter(id, table)? {
            store.check(id, started)?;
            let row = row?;
            let fields: &[&str] = match table {
                "file_contents" => &["id", "createdAt", "deletedAt", "blob", "bytes"],
                "request_replays" => &[
                    "id",
                    "requestKey",
                    "actorKey",
                    "operation",
                    "requestHash",
                    "response",
                    "createdAt",
                    "expiresAt",
                    "deletedAt",
                ],
                _ => &[
                    "id",
                    "data",
                    "version",
                    "createdAt",
                    "updatedAt",
                    "archivedAt",
                    "deletedAt",
                ],
            };
            let object = row.as_object().context("invalid_record")?;
            ensure!(
                object.len() == fields.len() && fields.iter().all(|key| object.contains_key(*key)),
                "invalid_record_fields"
            );
            let rid = uuid(&row["id"])?;
            ensure!(ids.insert((table.to_owned(), rid)), "duplicate_id");
            ensure!(ids.len() <= 1_000_000, "record_limit");
            for field in [
                "createdAt",
                "updatedAt",
                "archivedAt",
                "deletedAt",
                "expiresAt",
            ] {
                if let Some(value) = row.get(field) {
                    if let Some(time) = timestamp(value)? {
                        if driver == "postgres" && time.timestamp_subsec_nanos() % 1000 != 0 {
                            precision += 1
                        }
                    }
                }
            }
            ensure!(!row["createdAt"].is_null(), "missing_created_at");
            if TABLES.contains(&table) {
                ensure!(
                    row["version"].as_i64().is_some_and(|n| n > 0)
                        && row["data"].is_object()
                        && !row["updatedAt"].is_null(),
                    "invalid_record"
                );
                let data = &row["data"];
                for (key, target, nullable) in refs(table) {
                    if nullable && data[key].is_null() {
                        continue;
                    }
                    links.push((target.to_owned(), uuid(&data[key])?));
                }
                if matches!(table, "agents" | "teams" | "tasks") {
                    let slug = data["slug"].as_str().context("invalid_slug")?;
                    ensure!(
                        !slug.is_empty()
                            && slug.len() <= 80
                            && !slug.starts_with('-')
                            && !slug.ends_with('-')
                            && !slug.contains("--")
                            && slug
                                .bytes()
                                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-'),
                        "invalid_slug"
                    );
                    ensure!(
                        slugs.insert((table.to_owned(), slug.to_owned())),
                        "duplicate_slug"
                    );
                }
                if table == "statuses" {
                    status_boards.insert(rid, uuid(&data["boardId"])?);
                }
                if table == "tasks" {
                    for (key, max) in [("specification", 65536), ("currentSummary", 16384)] {
                        ensure!(
                            data[key].as_str().is_some_and(|s| s.len() <= max),
                            "invalid_markdown"
                        );
                    }
                    tasks.insert(
                        rid,
                        (
                            data["parentId"].as_str().map(Uuid::parse_str).transpose()?,
                            uuid(&data["rootTaskId"])?,
                            uuid(&data["originBoardId"])?,
                            uuid(&data["boardId"])?,
                            uuid(&data["statusId"])?,
                        ),
                    );
                }
                if table == "plan_revisions" {
                    ensure!(
                        data["content"].as_str().is_some_and(|s| s.len() <= 65536),
                        "invalid_markdown"
                    );
                }
                if table == "events" {
                    ensure!(
                        data["sequence"]
                            .as_i64()
                            .is_some_and(|s| s <= manifest.sequence_floor),
                        "invalid_sequence_floor"
                    );
                }
                if row["deletedAt"].is_null() && table == "teams" {
                    ensure!(
                        leaders
                            .values()
                            .all(|v| *v != uuid(&data["leaderId"]).unwrap()),
                        "duplicate_leader"
                    );
                    leaders.insert(rid, uuid(&data["leaderId"])?);
                }
                if row["deletedAt"].is_null() && table == "memberships" {
                    let agent = uuid(&data["agentId"])?;
                    ensure!(members.insert(agent), "duplicate_membership");
                    memberships.push((uuid(&data["teamId"])?, agent));
                }
            } else if table == "file_contents" {
                let path = format!("blobs/{rid}.bin");
                ensure!(row["blob"] == path, "invalid_blob_path");
                let entry = manifest.entries.get(&path).context("missing_blob")?;
                ensure!(
                    row["bytes"].as_u64() == Some(entry.bytes),
                    "blob_size_mismatch"
                );
                blobs.insert(path);
            } else {
                for key in [
                    "requestKey",
                    "actorKey",
                    "operation",
                    "requestHash",
                    "expiresAt",
                ] {
                    ensure!(row[key].is_string(), "invalid_replay");
                }
                Uuid::parse_str(row["requestKey"].as_str().unwrap())?;
                ensure!(row.get("response").is_some(), "missing_replay_response");
            }
        }
    }
    for link in links {
        store.check(id, started)?;
        ensure!(ids.contains(&link), "orphan_reference");
    }
    for (team, agent) in memberships {
        ensure!(leaders.get(&team) != Some(&agent), "role_conflict");
    }
    let mut resolved = BTreeMap::new();
    for (rid, (parent, root, origin, board, status)) in &tasks {
        store.check(id, started)?;
        ensure!(
            status_boards.get(status) == Some(board),
            "status_board_mismatch"
        );
        let mut cursor = *rid;
        let mut path = Vec::new();
        let mut seen = BTreeSet::new();
        let context = loop {
            store.check(id, started)?;
            if let Some(context) = resolved.get(&cursor) {
                break *context;
            }
            ensure!(seen.insert(cursor), "parent_cycle");
            path.push(cursor);
            let item = tasks.get(&cursor).context("missing_parent")?;
            if let Some(p) = item.0 {
                cursor = p;
            } else {
                break (cursor, item.3);
            }
        };
        ensure!(context == (*root, *origin), "invalid_origin");
        for member in path {
            let item = tasks.get(&member).unwrap();
            ensure!((item.1, item.2) == context, "invalid_origin");
            resolved.insert(member, context);
        }
        if parent.is_none() {
            ensure!(rid == root && origin == board, "invalid_root");
        }
    }
    let inventory: BTreeSet<_> = manifest
        .entries
        .keys()
        .filter(|p| p.starts_with("blobs/"))
        .cloned()
        .collect();
    ensure!(blobs == inventory, "orphan_blob");
    Ok(precision)
}
