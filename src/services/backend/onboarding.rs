//! Bee Team HQ: the protected system team every installation starts with.
//! The seed reuses the ordinary command handlers inside one write transaction,
//! so the created records are indistinguishable from user-created ones apart
//! from the `systemKey` and the pristine-seed marker.
use super::{kanban, ra};
use crate::{
    dto::backend::*,
    repositories::{
        contracts::{ResourceStore, UnitOfWork},
        records::Record,
    },
};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

pub const SYSTEM_KEY: &str = "onboarding";
/// Stored on every seeded row with its version at seed commit; any later edit
/// makes the row non-pristine (see portable transfer restore).
pub const SEED_MARKER: &str = "onboardingSeedVersion";
const SEED_REF: &str = "bee-team-onboarding-seed";

const TASKS: &[&str] = &[
    include_str!("../../../resources/onboarding/01-tour.md"),
    include_str!("../../../resources/onboarding/02-configure-guide.md"),
    include_str!("../../../resources/onboarding/03-first-team.md"),
    include_str!("../../../resources/onboarding/04-add-workers.md"),
    include_str!("../../../resources/onboarding/05-board-and-task.md"),
    include_str!("../../../resources/onboarding/06-connect-harness.md"),
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OnboardingIds {
    pub agent_id: Uuid,
    pub team_id: Uuid,
    pub board_id: Uuid,
}

pub fn is_system(record: &Record) -> bool {
    record.data["systemKey"].is_string()
}

pub(super) fn protect(record: &Record) -> Result<()> {
    if is_system(record) {
        return Err(Failure::new(
            "system_resource_protected",
            "System onboarding resources cannot be archived, reassigned or transferred",
        ));
    }
    Ok(())
}

pub async fn ensure(repository: &dyn ResourceStore) -> Result<OnboardingIds> {
    match seed(repository).await {
        // Another process committed the seed concurrently; the unique index kept one copy.
        Err(e) if e.details["reason"] == "constraint_conflict" => seed(repository).await,
        other => other,
    }
}

async fn seed(repository: &dyn ResourceStore) -> Result<OnboardingIds> {
    let mut unit = repository.begin().await?;
    if let Some(ids) = existing(&unit) {
        unit.rollback().await?;
        return Ok(ids);
    }
    let before: BTreeSet<_> = unit.records.rows.keys().copied().collect();
    let ids = match create(&mut unit).await {
        Ok(ids) => ids,
        Err(e) => {
            unit.rollback().await?;
            return Err(e);
        }
    };
    for (table, id) in [
        ("agents", ids.agent_id),
        ("teams", ids.team_id),
        ("boards", ids.board_id),
    ] {
        unit.records.get_mut(table, id)?.data["systemKey"] = json!(SYSTEM_KEY);
    }
    for (key, record) in unit.records.rows.iter_mut() {
        if !before.contains(key) {
            record.data[SEED_MARKER] = json!(record.version);
        }
    }
    unit.commit().await?;
    Ok(ids)
}

fn existing(unit: &UnitOfWork) -> Option<OnboardingIds> {
    let find = |table| {
        unit.records
            .list(table)
            .into_iter()
            .find(|r| r.data["systemKey"] == SYSTEM_KEY)
            .map(|r| r.id)
    };
    let team_id = find("teams")?;
    Some(OnboardingIds {
        agent_id: find("agents").unwrap_or(Uuid::nil()),
        team_id,
        board_id: find("boards").unwrap_or(Uuid::nil()),
    })
}

async fn create(unit: &mut UnitOfWork) -> Result<OnboardingIds> {
    let agent_id = created(ra::run(unit, &command("createAgent", &[], json!({
        "name": "Bee Team Guide",
        "roleDescription": "Leader of Bee Team HQ. Helps you set up Bee Team: create teams, agents and boards, and plan their first tasks.",
        "workStyle": "Patient and practical. Explains each step briefly and confirms before creating or changing anything.",
        "workInstructions": "Guide the user through the Getting started board. Prefer the Bee Team MCP tools and skills to create teams, agents, boards and tasks on the user's behalf after they agree.",
    }))).await?)?;
    let team_id = created(ra::run(unit, &command("createTeam", &[], json!({
        "name": "Bee Team HQ",
        "purpose": "Your starting point: talk to the guide to create and manage teams, agents and boards.",
        "context": "System team created automatically by Bee Team. It cannot be archived and its leader cannot be replaced.",
        "leaderId": agent_id,
        "workerIds": [],
        "coordinationContext": coordination(),
    }))).await?)?;
    let board_id = created(kanban::run(unit, &command("createBoard", &[], json!({
        "teamId": team_id,
        "name": "Getting started",
        "description": "Onboarding tasks that teach you how to use and configure Bee Team.",
        "autonomyMode": "manual",
    }))).await?)?;
    let board = board_id.to_string();
    for content in TASKS {
        let (title, description, specification) = parse(content);
        kanban::run(unit, &command("createTask", &[("boardId", &board)], json!({
            "title": title,
            "description": description,
            "specification": specification,
            "authorAgentId": agent_id,
            "executorAgentId": agent_id,
            "workScope": {"status": "not_applicable", "projects": [], "repositories": []},
            "coordinationContext": coordination(),
        }))).await?;
    }
    Ok(OnboardingIds { agent_id, team_id, board_id })
}

fn command(operation: &str, params: &[(&str, &str)], body: Value) -> Command {
    Command {
        operation: operation.into(),
        params: params
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect::<BTreeMap<_, _>>(),
        query: BTreeMap::new(),
        body,
        actor: Some(Actor { kind: "human".into(), id: None }),
        expected_version: None,
        idempotency_key: Some(Uuid::now_v7()),
        upload: None,
    }
}

fn coordination() -> Value {
    json!({"mode": "manual", "conversationRef": SEED_REF, "approvalRef": SEED_REF})
}

fn created(outcome: Outcome) -> Result<Uuid> {
    outcome
        .created_id
        .ok_or_else(|| Failure::invalid("Onboarding seed did not create a resource"))
}

/// `# Title`, then the first paragraph as description; the full body is the specification.
fn parse(content: &str) -> (String, String, String) {
    let (heading, body) = content.split_once('\n').unwrap_or((content, ""));
    let title = heading.trim_start_matches('#').trim().to_string();
    let body = body.trim().to_string();
    let description = body.split("\n\n").next().unwrap_or("").trim().to_string();
    (title, description, body)
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_onboarding_task_has_title_summary_and_specification() {
        for content in super::TASKS {
            let (title, description, specification) = super::parse(content);
            assert!(!title.is_empty() && title.len() <= 200 && !title.starts_with('#'));
            assert!(!description.is_empty() && !description.contains('\n'));
            assert!(specification.contains("## Done when"));
        }
    }
}
