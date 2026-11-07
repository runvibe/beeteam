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
use std::collections::BTreeSet;
use uuid::Uuid;

pub(super) async fn run(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let body = &c.body;
    match c.operation.as_str() {
        "createAgentWithSession" | "claimAgentSession" => super::session_bindings::run(unit,c).await,
        "createAgent" => {
            let mut data = defaults(
                body,
                &[
                    "roleDescription",
                    "workStyle",
                    "workInstructions",
                    "contextSummary",
                ],
            );
            for field in ["rules", "accessLimits"] {
                if data.get(field).is_none() {
                    data[field] = json!([]);
                }
            }
            if data.get("image").is_none() {
                data["image"] = Value::Null;
            }
            validate_url(data["image"]["url"].as_str())?;
            data["slug"] = json!(
                unit.allocate_slug("agents", data["name"].as_str().unwrap())
                    .await?
            );
            let id = unit.records.insert(Record::new("agents", data));
            outcome(&unit.records, "agents", id, true)
        }
        "updateAgent" | "archiveAgent" => {
            let id = c.id("agentId")?;
            let agent = unit.records.get("agents", id)?.clone();
            check_version(&agent, c.expected_version)?;
            if c.operation == "updateAgent" {
                active(&unit.records, "agents", id)?;
                validate_url(body["image"]["url"].as_str())?;
                if body.get("image").is_some() {
                    retire_image(unit, id).await?;
                }
            }
            if body["archived"] == true
                && (unit
                    .records
                    .list("teams")
                    .iter()
                    .any(|t| t.reference("leaderId") == Some(id))
                    || unit
                        .records
                        .list("memberships")
                        .iter()
                        .any(|m| m.reference("agentId") == Some(id)))
            {
                return Err(Failure::new(
                    "agent_in_use",
                    "Transfer role bindings before archiving the agent",
                ));
            }
            if body["archived"] == true
                && unit.records.list("tasks").iter().any(|task| {
                    task.reference("executorAgentId") == Some(id)
                        && task
                            .reference("statusId")
                            .and_then(|sid| unit.records.get("statuses", sid).ok())
                            .is_some_and(|status| status.data["isDone"] != true)
                })
            {
                return Err(Failure::new(
                    "agent_in_use",
                    "Reassign unfinished tasks before archiving the executor",
                ));
            }
            if body["archived"] == true { super::session_bindings::close_for_archive(unit,c,id)?; }
            patch(
                unit.records.get_mut("agents", id)?,
                body,
                &[
                    "name",
                    "roleDescription",
                    "workStyle",
                    "workInstructions",
                    "rules",
                    "accessLimits",
                    "contextSummary",
                    "image",
                ],
            );
            outcome(&unit.records, "agents", id, false)
        }
        "createTeam" => {
            coordination(body, "manual")?;
            let mut data = defaults(body, &["purpose", "context"]);
            data.as_object_mut().unwrap().remove("workerIds");
            data.as_object_mut().unwrap().remove("coordinationContext");
            data["slug"] = json!(
                unit.allocate_slug("teams", data["name"].as_str().unwrap())
                    .await?
            );
            team_role_icons::defaults(&mut data);
            let id = unit.records.insert(Record::new("teams", data));
            let members = body["workerIds"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            set_members(&mut unit.records, id, &members)?;
            validate_composition(&unit.records)?;
            let affected = team_agents(&unit.records, id);
            touch_agents(&mut unit.records, affected)?;
            outcome(&unit.records, "teams", id, true)
        }
        "updateTeam" | "archiveTeam" => {
            let id = c.id("teamId")?;
            check_version(unit.records.get("teams", id)?, c.expected_version)?;
            if c.operation == "updateTeam" {
                active(&unit.records, "teams", id)?;
            }
            patch(
                unit.records.get_mut("teams", id)?,
                body,
                &["name", "purpose", "context", "leaderIconId", "workerIconId"],
            );
            team_role_icons::defaults(&mut unit.records.get_mut("teams", id)?.data);
            outcome(&unit.records, "teams", id, false)
        }
        "changeTeamComposition" => {
            coordination(body, "manual")?;
            let teams = body["teams"].as_array().unwrap();
            let mut seen = BTreeSet::new();
            let mut touched = BTreeSet::new();
            for change in teams {
                let id = body_id(change, "teamId")?;
                if !seen.insert(id) {
                    return Err(Failure::invalid("Duplicate teamId"));
                }
                let team = unit.records.get("teams", id)?;
                if Some(team.version) != change["expectedVersion"].as_i64() {
                    return Err(Failure::new("composition_conflict", "Team version changed"));
                }
                touched.extend(team_agents(&unit.records, id));
            }
            for change in teams {
                let id = body_id(change, "teamId")?;
                let team = unit.records.get_mut("teams", id)?;
                team.data["leaderId"] = change["leaderId"].clone();
                team.touch();
                set_members(
                    &mut unit.records,
                    id,
                    change["workerIds"].as_array().unwrap(),
                )?;
                touched.extend(team_agents(&unit.records, id));
            }
            validate_composition(&unit.records)?;
            touch_agents(&mut unit.records, touched)?;
            let teams = seen
                .into_iter()
                .map(|id| queries::resource(&unit.records, "teams", id))
                .collect::<Result<Vec<_>>>()?;
            Ok(Outcome::data(json!({"teams":teams})))
        }
        "copyAgent" => {
            coordination(body, "manual")?;
            let source = unit.records.get("agents", c.id("agentId")?)?.clone();
            check_version(&source, c.expected_version)?;
            let target = body_id(body, "targetTeamId")?;
            let team = active(&unit.records, "teams", target)?;
            if Some(team.version) != body["expectedTeamVersion"].as_i64() {
                return Err(Failure::new(
                    "composition_conflict",
                    "Target team version changed",
                ));
            }
            let mut data = source.data.clone();
            data["contextSummary"] = body.get("contextSummary").cloned().unwrap_or(json!(""));
            if let Some(name) = body.get("name") {
                data["name"] = name.clone();
            }
            data["slug"] = json!(
                unit.allocate_slug("agents", data["name"].as_str().unwrap())
                    .await?
            );
            let id = unit.records.insert(Record::new("agents", data));
            if source.data["image"]["kind"] == "upload"
                || source.data["image"]["kind"] == "uploaded"
            {
                let image_id = body_id(&source.data["image"], "imageId")?;
                let mut image = unit.records.get("images", image_id)?.data.clone();
                let bytes = unit.file(body_id(&image, "contentId")?).await?;
                let content = unit.put_file(&bytes).await?;
                image["contentId"] = json!(content);
                image["agentId"] = json!(id);
                let image_id = unit.records.insert(Record::new("images", image));
                let agent = unit.records.get_mut("agents", id)?;
                agent.data["image"]["imageId"] = json!(image_id);
                agent.data["image"]["contentPath"] =
                    json!(format!("/api/v2/agents/{id}/image/content"));
            }
            unit.records.insert(Record::new(
                "memberships",
                json!({"teamId":target,"agentId":id}),
            ));
            validate_composition(&unit.records)?;
            unit.records.get_mut("teams", target)?.touch();
            let mut result = Outcome::data(
                json!({"agent":queries::resource(&unit.records,"agents",id)?,"targetTeam":queries::resource(&unit.records,"teams",target)?}),
            );
            result.created_id = Some(id);
            result.version = Some(1);
            Ok(result)
        }
        "createChatReference" | "updateChatReference" => {
            let id = c.id("agentId")?;
            active(&unit.records, "agents", id)?;
            validate_url(body["url"].as_str())?;
            let reference = if c.operation == "createChatReference" {
                check_version(unit.records.get("agents", id)?, c.expected_version)?;
                if unit.records.list("chat_references").iter().any(|r| {
                    r.reference("agentId") == Some(id)
                        && r.data["harness"] == body["harness"]
                        && r.data["externalId"] == body["externalId"]
                }) {
                    return Err(Failure::new(
                        "duplicate_reference",
                        "Chat reference already exists",
                    ));
                }
                let mut data = body.clone();
                data["agentId"] = json!(id);
                data["url"] = body.get("url").cloned().unwrap_or(Value::Null);
                data["createdByActorId"] = json!(c.actor()?.id);
                data["actorKind"] = json!(c.actor()?.kind);
                unit.records.insert(Record::new("chat_references", data))
            } else {
                let rid = c.id("chatReferenceId")?;
                let r = unit.records.get("chat_references", rid)?;
                if r.reference("agentId") != Some(id) {
                    return Err(Failure::missing());
                }
                check_version(r, c.expected_version)?;
                patch(
                    unit.records.get_mut("chat_references", rid)?,
                    body,
                    &["label", "url"],
                );
                rid
            };
            unit.records.get_mut("agents", id)?.touch();
            outcome(
                &unit.records,
                "chat_references",
                reference,
                c.operation == "createChatReference",
            )
        }
        _ => Err(Failure::missing()),
    }
}
fn team_agents(records: &Records, id: Uuid) -> BTreeSet<Uuid> {
    let mut ids = BTreeSet::new();
    if let Ok(team) = records.get("teams", id) {
        ids.extend(team.reference("leaderId"));
    }
    ids.extend(
        records
            .list("memberships")
            .iter()
            .filter(|r| r.reference("teamId") == Some(id))
            .filter_map(|r| r.reference("agentId")),
    );
    ids
}
fn touch_agents(records: &mut Records, ids: BTreeSet<Uuid>) -> Result<()> {
    for id in ids {
        records.get_mut("agents", id)?.touch();
    }
    Ok(())
}
fn set_members(records: &mut Records, team: Uuid, members: &[Value]) -> Result<()> {
    let mut desired = BTreeSet::new();
    for value in members {
        let id = value_id(value)?;
        active(records, "agents", id)?;
        if !desired.insert(id) {
            return Err(Failure::invalid("Duplicate worker"));
        }
    }
    let existing: Vec<_> = records
        .list("memberships")
        .into_iter()
        .filter(|r| r.reference("teamId") == Some(team))
        .map(|r| (r.id, r.reference("agentId").unwrap()))
        .collect();
    for (id, agent) in existing {
        if desired.remove(&agent) {
            continue;
        }
        let r = records.get_mut("memberships", id)?;
        r.deleted_at = Some(Utc::now());
        r.touch();
    }
    for agent in desired {
        records.insert(Record::new(
            "memberships",
            json!({"teamId":team,"agentId":agent}),
        ));
    }
    Ok(())
}
fn validate_composition(records: &Records) -> Result<()> {
    let mut leaders = BTreeSet::new();
    let mut workers = BTreeSet::new();
    for team in records.list("teams") {
        let leader = body_id(&team.data, "leaderId")?;
        active(records, "agents", leader)?;
        if !leaders.insert(leader) {
            return Err(Failure::new(
                "role_cardinality_conflict",
                "Agent already leads another team",
            ));
        }
        for m in records
            .list("memberships")
            .into_iter()
            .filter(|m| m.reference("teamId") == Some(team.id))
        {
            let agent = m.reference("agentId").unwrap();
            active(records, "agents", agent)?;
            if agent == leader {
                return Err(Failure::new(
                    "same_team_roles",
                    "Leader cannot be a worker in the same team",
                ));
            }
            if !workers.insert(agent) {
                return Err(Failure::new(
                    "role_cardinality_conflict",
                    "Agent already works in another team",
                ));
            }
        }
    }
    Ok(())
}
pub(super) fn validate_url(value: Option<&str>) -> Result<()> {
    if let Some(value) = value {
        let url = url::Url::parse(value).map_err(|_| Failure::invalid("Invalid URL"))?;
        if !matches!(url.scheme(), "http" | "https" | "codex")
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err(Failure::invalid("URL must not contain credentials"));
        }
    }
    Ok(())
}
pub(super) async fn retire_image(unit: &mut UnitOfWork, agent: Uuid) -> Result<()> {
    let images: Vec<_> = unit
        .records
        .list("images")
        .into_iter()
        .filter(|i| i.reference("agentId") == Some(agent))
        .map(|i| (i.id, i.reference("contentId").unwrap()))
        .collect();
    for (id, content) in images {
        let image = unit.records.get_mut("images", id)?;
        image.deleted_at = Some(Utc::now());
        image.touch();
        unit.delete_file(content).await?;
    }
    Ok(())
}
