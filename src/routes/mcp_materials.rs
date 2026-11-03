use crate::dto::backend::*;
use serde_json::{json, Value};

pub const MATERIALS: &[(&str, &str, &str)] = &[
    ("beeteam://references/repository-evidence", "Structured projects and commit evidence", include_str!("../../resources/bee-team/references/repository-evidence.md")),
    ("beeteam://references/execution-intervals", "Explicit task session intervals", include_str!("../../resources/bee-team/references/execution-intervals.md")),
    (
        "beeteam://references/collaborator-bootstrap",
        "Collaborator chat-first bootstrap",
        include_str!("../../resources/bee-team/references/collaborator-bootstrap.md"),
    ),
    (
        "beeteam://references/usage-report",
        "Required execution usage reporting",
        include_str!("../../resources/bee-team/references/usage-report.md"),
    ),
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
    (
        "beeteam://references/leader-onboarding-flows",
        "Leader onboarding workflow",
        include_str!("../../resources/bee-team/references/leader-onboarding-flows.md"),
    ),
    (
        "beeteam://references/collaborator-workflow",
        "Collaborator workflow",
        include_str!("../../resources/bee-team/references/collaborator-workflow.md"),
    ),
    (
        "beeteam://references/mcp-content",
        "MCP content guidance",
        include_str!("../../resources/bee-team/references/mcp-content.md"),
    ),
    (
        "beeteam://references/task-briefing",
        "Task briefing template",
        include_str!("../../resources/bee-team/prompts/task-briefing.md"),
    ),
    (
        "beeteam://references/collaborator-resumption",
        "Collaborator resumption template",
        include_str!("../../resources/bee-team/prompts/collaborator-resumption.md"),
    ),
    (
        "beeteam://references/delivery-review",
        "Delivery review template",
        include_str!("../../resources/bee-team/prompts/delivery-review.md"),
    ),
    (
        "beeteam://references/content-manifest",
        "Prompt content manifest",
        include_str!("../../resources/bee-team/prompts/content-manifest.json"),
    ),
];
pub fn resources() -> Value {
    json!({"resources":MATERIALS.iter().map(|(uri,name,_)|json!({"uri":uri,"name":name,"mimeType":if uri.ends_with("content-manifest") { "application/json" } else { "text/markdown" },"description":format!("Discover current resources through resources/list. Bundled Skills commit 3265680f383f4645827b341fd95104fc97b00853 plus local SQLite startup guidance (2026-11-03). Links to bee-team-leader/SKILL.md and bee-team-collaborator/SKILL.md map to beeteam://skills/leader and beeteam://skills/collaborator. Other relative Markdown links map by basename (without .md/.json) to beeteam://references/{{name}}; workflow and prompt templates are listed resources. Resource: {}. No filesystem access or global installation.", uri)})).collect::<Vec<_>>()})
}
pub fn read(uri: &str) -> Result<Value> {
    let (_, _, text) = MATERIALS
        .iter()
        .find(|(allowed, _, _)| *allowed == uri)
        .ok_or_else(Failure::missing)?;
    Ok(
        json!({"contents":[{"uri":uri,"mimeType":if uri.ends_with("content-manifest") { "application/json" } else { "text/markdown" },"text":text}]}),
    )
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
