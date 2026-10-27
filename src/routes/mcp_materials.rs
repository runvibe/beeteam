use crate::dto::backend::*;
use serde_json::{json, Value};

pub const MATERIALS: &[(&str, &str, &str)] = &[
    (
        "beeteam://skills/leader",
        "Bee Team leader",
        include_str!("../../resources/bee-team/bee-team-leader/SKILL.md"),
    ),
    (
        "beeteam://skills/collaborator",
        "Bee Team collaborator",
        include_str!("../../resources/bee-team/bee-team-collaborator/SKILL.md"),
    ),
    (
        "beeteam://references/integration",
        "HTTP and MCP integration",
        include_str!("../../resources/bee-team/references/integration.md"),
    ),
    (
        "beeteam://references/handoff",
        "Handoff",
        include_str!("../../resources/bee-team/references/handoff.md"),
    ),
    (
        "beeteam://references/codex",
        "Codex guidance",
        include_str!("../../resources/bee-team/references/codex.md"),
    ),
    (
        "beeteam://references/team-examples",
        "Team examples",
        include_str!("../../resources/bee-team/bee-team-leader/references/team-examples.md"),
    ),
];
pub fn resources() -> Value {
    json!({"resources":MATERIALS.iter().map(|(uri,name,_)|json!({"uri":uri,"name":name,"mimeType":"text/markdown","description":"Bundled Bee Team content, snapshot of Skills commit 25a615a. Not installed globally; never executed by this server."})).collect::<Vec<_>>()})
}
pub fn read(uri: &str) -> Result<Value> {
    let (_, _, text) = MATERIALS
        .iter()
        .find(|(allowed, _, _)| *allowed == uri)
        .ok_or_else(Failure::missing)?;
    Ok(json!({"contents":[{"uri":uri,"mimeType":"text/markdown","text":text}]}))
}
pub const PROMPT_TEMPLATES: &[(&str, &str, &str)] = &[
    (
        "task_briefing",
        "task-briefing.md",
        include_str!("../../resources/bee-team/prompts/task-briefing.md"),
    ),
    (
        "agent_resumption",
        "collaborator-resumption.md",
        include_str!("../../resources/bee-team/prompts/collaborator-resumption.md"),
    ),
    (
        "delivery_review",
        "delivery-review.md",
        include_str!("../../resources/bee-team/prompts/delivery-review.md"),
    ),
];
pub fn prompts() -> Value {
    let manifest: Value = serde_json::from_str(include_str!(
        "../../resources/bee-team/prompts/content-manifest.json"
    ))
    .expect("validated editorial manifest");
    json!({"prompts":PROMPT_TEMPLATES.iter().map(|(name,file,_)|{let entry=manifest["templates"].as_array().unwrap().iter().find(|e|e["file"]==*file).unwrap();json!({"name":name,"description":entry["description"],"arguments":entry["arguments"]})}).collect::<Vec<_>>()})
}
