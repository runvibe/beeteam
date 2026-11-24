//! Cross-agent team session listing over managed leader conversations.
use super::*;
use std::collections::BTreeMap;

pub(super) fn team_leader(records: &Records, team: Uuid, agent: Uuid) -> Result<()> {
    let row = records
        .get("teams", team)
        .map_err(|_| Failure::invalid("Team not found"))?;
    if row.archived_at.is_some() {
        return Err(Failure::invalid("Team is archived"));
    }
    if row.reference("leaderId") != Some(agent) {
        return Err(Failure::new(
            "conversation_mismatch",
            "Team sessions belong to the current team leader",
        ));
    }
    Ok(())
}

pub(super) fn team_board(records: &Records, team: Uuid, board: Uuid) -> Result<()> {
    let row = records
        .get("boards", board)
        .map_err(|_| Failure::invalid("Board not found"))?;
    if row.archived_at.is_some() || row.reference("teamId") != Some(team) {
        return Err(Failure::invalid(
            "Board must be active and belong to the session team",
        ));
    }
    Ok(())
}

impl ManagedAgentService {
    /// Lists team leader sessions across agents with database filtering, ordering and pagination.
    pub async fn sessions(&self, raw: &BTreeMap<String, String>) -> Result<Value> {
        let query = SessionListQuery::parse(raw)?;
        let mut c = command("sessions");
        let text = |ids: &[Uuid]| json!(ids.iter().map(Uuid::to_string).collect::<Vec<_>>());
        c.query.insert("teamIds".into(), text(&query.team_ids));
        c.query.insert("agentIds".into(), text(&query.agent_ids));
        let boards: Vec<Uuid> = query.board_ids.iter().flatten().copied().collect();
        c.query.insert("boardIds".into(), text(&boards));
        c.query.insert(
            "boardFilter".into(),
            json!(!query.board_ids.is_empty()),
        );
        c.query.insert(
            "noBoard".into(),
            json!(query.board_ids.iter().any(Option::is_none)),
        );
        c.query.insert(
            "ascending".into(),
            json!(query.sort == SessionSort::UpdatedAsc),
        );
        if let Some((time, id)) = query.after {
            c.query.insert(
                "afterTime".into(),
                json!(time.to_rfc3339_opts(chrono::SecondsFormat::Nanos, true)),
            );
            c.query.insert("afterId".into(), json!(id.to_string()));
        }
        c.query.insert("limit".into(), json!(query.limit));
        let u = self.store.read(&c).await?;
        let mut rows = u.records.list("managed_conversations");
        rows.sort_by_key(|r| (r.updated_at, r.id));
        if query.sort == SessionSort::UpdatedDesc {
            rows.reverse();
        }
        let more = rows.len() > query.limit;
        rows.truncate(query.limit);
        let next = more
            .then(|| rows.last().map(|r| session_cursor(query.sort, r.updated_at, r.id)))
            .flatten();
        let items: Vec<_> = rows.iter().map(|r| public(r)).collect();
        u.rollback().await?;
        Ok(json!({"items":items,"nextCursor":next}))
    }
}
