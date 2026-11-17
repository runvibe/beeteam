use crate::{
    dto::backend::{Failure, Result},
    repositories::records::Records,
};
use uuid::Uuid;

const COMMON: &str = include_str!("../../resources/bee-team/integrated-rules/common.md");
const LEADER: &str = include_str!("../../resources/bee-team/integrated-rules/leader.md");
const WORKER: &str = include_str!("../../resources/bee-team/integrated-rules/worker.md");
const GENERAL: &str = include_str!("../../resources/bee-team/integrated-rules/general.md");

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Role {
    Leader,
    Worker,
    Unassigned,
}

impl Role {
    pub(crate) fn instructions(self) -> String {
        let role = match self {
            Self::Leader => LEADER,
            Self::Worker => WORKER,
            Self::Unassigned => GENERAL,
        };
        format!("{COMMON}\n{role}")
    }
}

pub(crate) fn resolve(
    records: &Records,
    agent: Uuid,
    team: Option<Uuid>,
    task: Option<Uuid>,
) -> Result<Role> {
    let team = match (team, task) {
        (Some(team), _) => Some(team),
        (None, Some(task)) => {
            let board = records
                .get("tasks", task)?
                .reference("boardId")
                .ok_or_else(Failure::missing)?;
            Some(
                records
                    .get("boards", board)?
                    .reference("teamId")
                    .ok_or_else(Failure::missing)?,
            )
        }
        (None, None) => None,
    };
    let Some(team) = team else {
        return Ok(Role::Unassigned);
    };
    let team_record = records.get("teams", team)?;
    if team_record.reference("leaderId") == Some(agent) {
        return Ok(Role::Leader);
    }
    if records.list("memberships").iter().any(|member| {
        member.reference("teamId") == Some(team)
            && member.reference("agentId") == Some(agent)
            && member.archived_at.is_none()
    }) {
        return Ok(Role::Worker);
    }
    Ok(Role::Unassigned)
}
