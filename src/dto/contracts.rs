//! HTTP and MCP share validation against the checked-in OpenAPI contracts.
use super::backend::{Command, Failure, Result};
use serde_json::{json, Value};
use std::{collections::BTreeMap, sync::LazyLock};

pub struct Operation {
    pub name: String,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub document: Value,
    pub definition: Value,
    pub parameters: Vec<Value>,
}
pub static OPERATIONS: LazyLock<Vec<Operation>> = LazyLock::new(|| {
    let mut result = Vec::new();
    for source in [
        include_str!("../../docs/kanban-openapi.yaml"),
        include_str!("../../docs/ra-openapi.yaml"),
    ] {
        let doc: Value = serde_yaml::from_str(source).expect("valid checked-in OpenAPI");
        for (path, item) in doc["paths"].as_object().unwrap() {
            for method in ["get", "post", "put", "patch", "delete"] {
                let Some(def) = item.get(method) else {
                    continue;
                };
                let mut parameters = item["parameters"].as_array().cloned().unwrap_or_default();
                parameters.extend(def["parameters"].as_array().cloned().unwrap_or_default());
                let status = def["responses"]
                    .as_object()
                    .unwrap()
                    .keys()
                    .filter_map(|k| k.parse::<u16>().ok())
                    .find(|v| (200..300).contains(v))
                    .unwrap();
                result.push(Operation {
                    name: def["operationId"].as_str().unwrap().into(),
                    method: method.to_uppercase(),
                    path: path.clone(),
                    status,
                    document: doc.clone(),
                    definition: def.clone(),
                    parameters,
                });
            }
        }
    }
    result
});
pub fn operation(name: &str) -> Result<&'static Operation> {
    OPERATIONS
        .iter()
        .find(|o| o.name == name)
        .ok_or_else(Failure::missing)
}
pub fn resolve<'a>(doc: &'a Value, schema: &'a Value) -> &'a Value {
    schema
        .get("$ref")
        .and_then(Value::as_str)
        .and_then(|s| doc.pointer(s.trim_start_matches('#')))
        .unwrap_or(schema)
}
pub fn inline_schema(doc: &Value, value: &Value) -> Value {
    if value.get("$ref").is_some() {
        return inline_schema(doc, resolve(doc, value));
    }
    match value {
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(k, v)| (k.clone(), inline_schema(doc, v)))
                .collect(),
        ),
        Value::Array(a) => Value::Array(a.iter().map(|v| inline_schema(doc, v)).collect()),
        _ => value.clone(),
    }
}
pub fn normalize_ids(doc: &Value, schema: &Value, value: &mut Value) {
    let schema = resolve(doc, schema);
    if schema["format"] == "uuid" {
        if let Some(s) = value.as_str() {
            if let Ok(id) = uuid::Uuid::parse_str(s) {
                *value = json!(id);
            }
        }
        return;
    }
    if let Some(branches) = schema
        .get("oneOf")
        .or_else(|| schema.get("anyOf"))
        .and_then(Value::as_array)
    {
        if let Some(branch) = branches
            .iter()
            .find(|branch| validate_schema(doc, branch, value).is_ok())
        {
            normalize_ids(doc, branch, value);
        }
        return;
    }
    if let Some(object) = value.as_object_mut() {
        for (key, value) in object {
            if let Some(property) = schema["properties"].get(key) {
                normalize_ids(doc, property, value);
            }
        }
    }
    if let Some(items) = value.as_array_mut() {
        for item in items {
            if let Some(schema) = schema.get("items") {
                normalize_ids(doc, schema, item);
            }
        }
    }
}
pub fn validate_schema(doc: &Value, schema: &Value, value: &Value) -> Result<()> {
    let mut root = schema.clone();
    root["components"] = doc["components"].clone();
    let validator = jsonschema::options()
        .should_validate_formats(true)
        .build(&root)
        .map_err(|_| Failure::new("internal_error", "Invalid embedded schema"))?;
    if let Err(e) = validator.validate(value) {
        return Err(Failure::invalid(e.to_string()));
    }
    validate_bytes(doc, schema, value)
}
fn validate_bytes(doc: &Value, schema: &Value, value: &Value) -> Result<()> {
    let schema = resolve(doc, schema);
    if let (Some(max), Some(s)) = (schema["x-maxBytes"].as_u64(), value.as_str()) {
        if s.len() as u64 > max {
            return Err(Failure::invalid("Text exceeds UTF-8 byte limit"));
        }
    }
    if let Some(obj) = value.as_object() {
        for (k, v) in obj {
            if let Some(s) = schema["properties"].get(k) {
                validate_bytes(doc, s, v)?
            }
        }
    }
    if let Some(items) = value.as_array() {
        for item in items {
            if let Some(s) = schema.get("items") {
                validate_bytes(doc, s, item)?
            }
        }
    }
    Ok(())
}
pub fn query(op: &Operation, raw: Vec<(String, String)>) -> Result<BTreeMap<String, Value>> {
    let mut result = BTreeMap::new();
    for (key, value) in raw {
        if result.contains_key(&key) {
            return Err(Failure::invalid("Repeated query parameter"));
        }
        let param = op
            .parameters
            .iter()
            .map(|p| resolve(&op.document, p))
            .find(|p| p["in"] == "query" && p["name"] == key)
            .ok_or_else(|| Failure::invalid(format!("Unknown parameter: {key}")))?;
        let schema = &param["schema"];
        let value = match schema["type"].as_str() {
            Some("integer") => json!(value
                .parse::<i64>()
                .map_err(|_| Failure::invalid("Invalid integer"))?),
            Some("boolean") => json!(value
                .parse::<bool>()
                .map_err(|_| Failure::invalid("Invalid boolean"))?),
            Some("array") => json!(value.split(',').collect::<Vec<_>>()),
            _ => json!(value),
        };
        validate_schema(&op.document, schema, &value)?;
        let value = if schema["format"] == "uuid" {
            json!(super::backend::value_id(&value)?.to_string())
        } else if schema["type"] == "array" && schema["items"]["format"] == "uuid" {
            json!(value
                .as_array()
                .unwrap()
                .iter()
                .map(super::backend::value_id)
                .collect::<Result<Vec<_>>>()?)
        } else {
            value
        };
        result.insert(key, value);
    }
    for param in op
        .parameters
        .iter()
        .map(|p| resolve(&op.document, p))
        .filter(|p| p["in"] == "query")
    {
        if let (Some(name), Some(default)) =
            (param["name"].as_str(), param["schema"].get("default"))
        {
            result.entry(name.into()).or_insert_with(|| default.clone());
        }
    }
    for prefix in ["created", "updated", "occurred"] {
        if let (Some(from), Some(before)) = (
            result.get(&format!("{prefix}From")).and_then(Value::as_str),
            result
                .get(&format!("{prefix}Before"))
                .and_then(Value::as_str),
        ) {
            if chrono::DateTime::parse_from_rfc3339(from).unwrap()
                >= chrono::DateTime::parse_from_rfc3339(before).unwrap()
            {
                return Err(Failure::invalid("Range start must precede end"));
            }
        }
    }
    if result.get("rootOnly") == Some(&json!(true)) && result.contains_key("parentId") {
        return Err(Failure::invalid("parentId and rootOnly are incompatible"));
    }
    Ok(result)
}
pub fn validate(command: &Command) -> Result<()> {
    let op = operation(&command.operation)?;
    for value in command.params.values() {
        super::backend::parse_id(value)?;
    }
    if op.method != "GET" {
        command.actor()?.validate()?;
    }
    if op.method == "POST" && command.idempotency_key.is_none() {
        return Err(Failure::invalid("Idempotency-Key required"));
    }
    if let Some(schema) = op
        .definition
        .pointer("/requestBody/content/application~1json/schema")
    {
        validate_schema(&op.document, schema, &command.body)?;
    }
    if let Some(schema) = op
        .definition
        .pointer("/requestBody/content/multipart~1form-data/schema")
    {
        let upload = command
            .upload
            .as_ref()
            .ok_or_else(|| Failure::invalid("Exactly one file is required"))?;
        if !command.body.is_object() || command.body.get("file").is_some() {
            return Err(Failure::invalid(
                "Upload metadata must be an object without file field",
            ));
        }
        let mut metadata = command.body.clone();
        metadata["file"] = json!("");
        validate_schema(&op.document, schema, &metadata)?;
        let schema = resolve(&op.document, schema);
        let max = schema["properties"]["file"]["x-maxBytes"]
            .as_u64()
            .unwrap_or(20 * 1024 * 1024);
        if upload.bytes.len() as u64 > max {
            return Err(Failure::new(
                "payload_too_large",
                "File exceeds contract limit",
            ));
        }
    } else if command.upload.is_some() {
        return Err(Failure::invalid("This operation does not accept files"));
    }
    Ok(())
}
