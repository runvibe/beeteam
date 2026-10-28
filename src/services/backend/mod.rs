pub mod composite;
mod files;
pub mod hierarchy;
mod kanban;
mod queries;
mod ra;

use crate::{
    dto::{backend::*, contracts},
    repositories::resources::{Record, Records, ResourceRepository, UnitOfWork},
};
use chrono::Utc;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub async fn execute(repository: &ResourceRepository, mut command: Command) -> Result<Outcome> {
    contracts::validate_envelope(&command)?;
    let validation = contracts::validate(&command);
    if contracts::operation(&command.operation)?.method != "POST" {
        validation.clone()?;
    }
    for (name, value) in command.params.iter_mut() {
        if name != "slug" {
            *value = parse_id(value)?.to_string();
        }
    }
    let slug_table = match command.operation.as_str() {
        "resolveAgentSlug" => Some("agents"),
        "resolveTeamSlug" => Some("teams"),
        "resolveTaskSlug" => Some("tasks"),
        _ => None,
    };
    if let Some(table) = slug_table {
        let (id, slug) = repository
            .resolve_slug(table, &command.params["slug"])
            .await?;
        return Ok(Outcome::data(json!({"id":id,"slug":slug})));
    }
    let op = contracts::operation(&command.operation)?;
    if let Some(schema) = op
        .definition
        .pointer("/requestBody/content/application~1json/schema")
    {
        contracts::normalize_ids(&op.document, schema, &mut command.body);
    }
    let mut unit = repository.begin().await?;
    if let Some(actor) = &command.actor {
        if let Some(id) = actor.id {
            if op.method == "GET" {
                unit.records.get("agents", id)?;
            } else {
                active(&unit.records, "agents", id)?;
            }
        }
    }
    let actor_key = command.actor.as_ref().map(|a| a.key()).unwrap_or_default();
    let operation_key = format!(
        "{}:{}",
        command.operation,
        serde_json::to_string(&command.params).unwrap()
    );
    let mut digest = Sha256::new();
    digest
        .update(serde_json::to_vec(&json!([command.body, command.params, command.query])).unwrap());
    if let Some(upload) = &command.upload {
        digest.update(&upload.bytes);
        digest.update(upload.name.as_bytes());
        digest.update(upload.media_type.as_bytes());
    }
    let hash = digest
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    if op.method == "POST" {
        if let Some(mut replay) = unit
            .replay(
                &actor_key,
                &operation_key,
                command.idempotency_key.unwrap(),
                &hash,
            )
            .await?
        {
            fill_legacy_task_fields(&mut replay.data);
            fill_legacy_slugs(&mut replay.data, &unit.records);
            return Ok(replay);
        }
    }
    // Exact saved replays remain valid across additive contract upgrades.
    // New mutations must always satisfy the current full request schema.
    validation?;
    let mut result = if matches!(
        command.operation.as_str(),
        "uploadAgentImage"
            | "removeAgentImage"
            | "downloadAgentImage"
            | "createAttachment"
            | "removeAttachment"
            | "downloadAttachment"
    ) {
        files::run(&mut unit, &command).await?
    } else if op.method == "GET" {
        Outcome::data(queries::run(&unit.records, &command)?)
    } else if op.path.contains("agents")
        || op.path.contains("teams")
        || command.operation == "changeTeamComposition"
    {
        ra::run(&mut unit, &command).await?
    } else {
        kanban::run(&mut unit, &command).await?
    };
    if let Some(schema) = op.definition.pointer(&format!(
        "/responses/{}/content/application~1json/schema",
        op.status
    )) {
        result.data = project(&op.document, schema, &result.data);
    }
    if op.method == "POST" {
        unit.save_replay(
            &actor_key,
            &operation_key,
            command.idempotency_key.unwrap(),
            &hash,
            &result,
        )
        .await?;
    }
    unit.commit().await?;
    Ok(result)
}
fn project(doc: &Value, schema: &Value, value: &Value) -> Value {
    let schema = contracts::resolve(doc, schema);
    if let Some(alternatives) = schema
        .get("anyOf")
        .or_else(|| schema.get("oneOf"))
        .and_then(Value::as_array)
    {
        for s in alternatives {
            let candidate = project(doc, s, value);
            if contracts::validate_schema(doc, s, &candidate).is_ok() {
                return candidate;
            }
        }
        return value.clone();
    }
    if let (Some(properties), Some(object)) = (schema["properties"].as_object(), value.as_object())
    {
        let mut out = serde_json::Map::new();
        for (k, s) in properties {
            if let Some(v) = object.get(k) {
                out.insert(k.clone(), project(doc, s, v));
            }
        }
        return Value::Object(out);
    }
    if let (Some(items), Some(schema)) = (value.as_array(), schema.get("items")) {
        return Value::Array(items.iter().map(|v| project(doc, schema, v)).collect());
    }
    value.clone()
}
pub(super) fn active<'a>(records: &'a Records, table: &str, id: Uuid) -> Result<&'a Record> {
    let r = records.get(table, id)?;
    if r.archived_at.is_some() {
        return Err(Failure::new("archived_resource", "Resource is archived"));
    }
    Ok(r)
}
pub(super) fn check_version(record: &Record, expected: Option<i64>) -> Result<()> {
    let expected =
        expected.ok_or_else(|| Failure::new("version_required", "Expected version is required"))?;
    if expected != record.version {
        return Err(Failure::new("version_conflict", "Resource has changed"));
    }
    Ok(())
}
pub(super) fn body_id(body: &Value, key: &str) -> Result<Uuid> {
    value_id(&body[key])
}
pub(super) fn archive(record: &mut Record, body: &Value) {
    if let Some(value) = body["archived"].as_bool() {
        record.archived_at = if value { Some(Utc::now()) } else { None };
    }
}
pub(super) fn patch(record: &mut Record, body: &Value, fields: &[&str]) {
    for &field in fields {
        if let Some(value) = body.get(field) {
            record.data[field] = value.clone();
        }
    }
    archive(record, body);
    record.touch();
}
pub(super) fn defaults(body: &Value, fields: &[&str]) -> Value {
    let mut value = body.clone();
    for &field in fields {
        if value.get(field).is_none() {
            value[field] = json!("");
        }
    }
    value
}
pub(super) fn coordination(body: &Value, effective: &str) -> Result<()> {
    let context = &body["coordinationContext"];
    if context["mode"] != effective {
        return Err(Failure::new(
            "coordination_mode_mismatch",
            format!("Expected {effective} coordination context"),
        ));
    }
    Ok(())
}
pub(super) async fn event(
    unit: &mut UnitOfWork,
    command: &Command,
    task: Uuid,
    kind: &str,
    data: Value,
) -> Result<()> {
    let actor = command.actor()?;
    let sequence = unit.sequence().await?;
    unit.records.insert(Record::new("events",json!({"taskId":task,"type":kind,"actorKind":actor.kind,"actorId":actor.id,"occurredAt":Utc::now(),"sequence":sequence,"data":data})));
    Ok(())
}
pub(super) fn outcome(records: &Records, table: &str, id: Uuid, created: bool) -> Result<Outcome> {
    let mut result = Outcome::data(queries::resource(records, table, id)?);
    if created {
        result.created_id = Some(id)
    }
    Ok(result)
}

// Compatibility for idempotent response snapshots recorded before currentSummary/specification existed.
// Do not read today's task: a replay must retain the original snapshot/version.
pub(super) fn fill_legacy_task_fields(value: &mut Value) {
    match value {
        Value::Object(fields) => {
            if [
                "boardId",
                "authorAgentId",
                "executorAgentId",
                "progress",
                "latestExecutionSummaryId",
            ]
            .iter()
            .all(|k| fields.contains_key(*k))
            {
                fields.entry("currentSummary").or_insert(json!(""));
                fields.entry("specification").or_insert(json!(""));
            }
            for child in fields.values_mut() {
                fill_legacy_task_fields(child);
            }
        }
        Value::Array(items) => {
            for child in items {
                fill_legacy_task_fields(child);
            }
        }
        _ => {}
    }
}
#[cfg(test)]
mod current_summary_replay_tests {
    use super::*;
    #[test]
    fn legacy_replays_get_empty_summary_without_rewriting_existing_or_history() {
        let task = json!({"boardId":"board","authorAgentId":"author","executorAgentId":"executor","progress":{"note":"Not a summary"},"latestExecutionSummaryId":null});
        let mut explicit = task.clone();
        explicit["currentSummary"] = json!("Explicit synthesis");
        explicit["specification"] = json!("# Requirements\r\n");
        let history = json!({"summary":"Historical entry"});
        let mut value = json!({"task":task,"updatedTasks":[explicit],"executionSummary":history});
        fill_legacy_task_fields(&mut value);
        assert_eq!(value["task"]["currentSummary"], "");
        assert_eq!(value["task"]["specification"], "");
        assert_eq!(
            value["updatedTasks"][0]["specification"],
            "# Requirements\r\n"
        );
        assert_eq!(
            value["updatedTasks"][0]["currentSummary"],
            "Explicit synthesis"
        );
        assert_eq!(value["executionSummary"], history);
    }
}

// Slugs are immutable identity metadata; use stored values even for retired entities.
pub(super) fn fill_legacy_slugs(value: &mut Value, records: &Records) {
    match value {
        Value::Object(fields) => {
            let table = if fields.contains_key("authorAgentId") && fields.contains_key("boardId") {
                Some("tasks")
            } else if fields.contains_key("roleDescription") && fields.contains_key("workStyle") {
                Some("agents")
            } else if fields.contains_key("leaderId") && fields.contains_key("purpose") {
                Some("teams")
            } else {
                None
            };
            if !fields.contains_key("slug") {
                if let (Some(table), Some(id)) = (
                    table,
                    fields
                        .get("id")
                        .and_then(Value::as_str)
                        .and_then(|v| Uuid::parse_str(v).ok()),
                ) {
                    if let Some(record) = records.rows.get(&(table, id)) {
                        fields.insert("slug".into(), record.data["slug"].clone());
                    }
                }
            }
            for child in fields.values_mut() {
                fill_legacy_slugs(child, records);
            }
        }
        Value::Array(items) => {
            for child in items {
                fill_legacy_slugs(child, records);
            }
        }
        _ => {}
    }
}
