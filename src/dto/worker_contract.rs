//! Versioned Worker vocabulary. Only schema-declared fields/enums are transformed;
//! authored strings, arbitrary JSON, and stored transfer/replay bytes are not edited.
use super::{
    backend::{Command, Failure, Result},
    contracts::{self, Operation},
};
use serde_json::Value;

const FIELDS: &[(&str, &str)] = &[
    ("workerTeamId", "collaboratorTeamId"),
    ("workerCount", "collaboratorCount"),
    ("workerIds", "collaboratorIds"),
    ("workerIconId", "collaboratorIconId"),
    ("workerId", "collaboratorId"),
    ("worker", "collaborator"),
];

pub fn transform(
    doc: &Value,
    schema: &Value,
    value: &mut Value,
    legacy: bool,
    strict: bool,
) -> Result<()> {
    let schema = contracts::resolve(doc, schema);
    if schema["pattern"]
        .as_str()
        .is_some_and(|p| p.starts_with("^/api/v2/"))
    {
        if let Some(path) = value.as_str() {
            *value = Value::String(if legacy {
                path.replacen("/api/v2/", "/api/v1/", 1)
            } else {
                path.replacen("/api/v1/", "/api/v2/", 1)
            });
        }
    }
    for key in ["allOf", "anyOf", "oneOf"] {
        if let Some(branches) = schema[key].as_array() {
            for branch in branches {
                transform(doc, branch, value, legacy, strict)?;
            }
        }
    }
    if schema["enum"]
        .as_array()
        .is_some_and(|items| items.iter().any(|v| v == "worker"))
    {
        if !legacy && value == "collaborator" {
            *value = Value::String("worker".into());
        }
        if legacy && value == "worker" {
            *value = Value::String("collaborator".into());
        }
    }
    if let (Some(properties), Some(object)) =
        (schema["properties"].as_object(), value.as_object_mut())
    {
        for (new, old) in FIELDS {
            if !properties.contains_key(*new) {
                continue;
            }
            if !legacy && object.contains_key(*old) {
                if strict && object.contains_key(*new) {
                    return Err(Failure::invalid(format!(
                        "Use only {new}; legacy alias {old} cannot be supplied together"
                    )));
                }
                let old_value = object.remove(*old).unwrap();
                object.entry((*new).to_owned()).or_insert(old_value);
            }
        }
        for (key, child_schema) in properties {
            if let Some(child) = object.get_mut(key) {
                transform(doc, child_schema, child, legacy, strict)?;
            }
        }
        if legacy {
            for (new, old) in FIELDS {
                if properties.contains_key(*new) {
                    if let Some(child) = object.remove(*new) {
                        object.insert((*old).into(), child);
                    }
                }
            }
        }
    }
    if let Some(items) = value.as_array_mut() {
        if let Some(item_schema) = schema.get("items") {
            for item in items {
                transform(doc, item_schema, item, legacy, strict)?;
            }
        }
    }
    Ok(())
}

pub fn body(op: &Operation, value: &mut Value, legacy: bool, strict: bool) -> Result<()> {
    if let Some(schema) = op
        .definition
        .pointer("/requestBody/content/application~1json/schema")
    {
        transform(&op.document, schema, value, legacy, strict)?;
    }
    Ok(())
}
pub fn response(op: &Operation, value: &mut Value, legacy: bool) -> Result<()> {
    if let Some(schema) = op.definition.pointer(&format!(
        "/responses/{}/content/application~1json/schema",
        op.status
    )) {
        transform(&op.document, schema, value, legacy, false)?;
    }
    Ok(())
}
pub fn query(op: &Operation, raw: Vec<(String, String)>) -> Result<Vec<(String, String)>> {
    raw.into_iter()
        .map(|(mut key, mut value)| {
            for (new, old) in FIELDS {
                if key == *old
                    && op
                        .parameters
                        .iter()
                        .any(|p| contracts::resolve(&op.document, p)["name"] == *new)
                {
                    key = (*new).into();
                }
            }
            if let Some(p) = op
                .parameters
                .iter()
                .map(|p| contracts::resolve(&op.document, p))
                .find(|p| p["in"] == "query" && p["name"] == key)
            {
                let mut v = Value::String(value);
                transform(&op.document, &p["schema"], &mut v, false, true)?;
                value = v.as_str().unwrap().into();
            }
            Ok((key, value))
        })
        .collect()
}
/// Stable pre-migration representation for idempotency hashes, across HTTP versions/MCP.
pub fn replay_input(command: &Command) -> Result<Value> {
    let op = contracts::operation(&command.operation)?;
    let mut body_value = command.body.clone();
    body(op, &mut body_value, true, false)?;
    let mut query_value = serde_json::to_value(&command.query).unwrap();
    let properties = op
        .parameters
        .iter()
        .map(|p| contracts::resolve(&op.document, p))
        .filter(|p| p["in"] == "query")
        .map(|p| (p["name"].as_str().unwrap().to_owned(), p["schema"].clone()))
        .collect::<serde_json::Map<_, _>>();
    transform(
        &op.document,
        &serde_json::json!({"properties":properties}),
        &mut query_value,
        true,
        false,
    )?;
    Ok(serde_json::json!([body_value, command.params, query_value]))
}

pub fn observation(mut value: Value) -> Value {
    if value["actorRole"] == "collaborator" {
        value["actorRole"] = "worker".into();
    }
    value
}
