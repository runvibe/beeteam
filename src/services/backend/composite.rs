use super::*;
use crate::{
    dto::{backend::*, contracts, mcp},
    repositories::contracts::{ResourceStore, UnitOfWork},
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

pub async fn execute(repository: &dyn ResourceStore, name: &str, input: Value) -> Result<Value> {
    let definition = mcp::composite_tools()
        .into_iter()
        .find(|t| t["name"] == name)
        .ok_or_else(Failure::missing)?;
    let schema = &definition["inputSchema"];
    let validation = contracts::validate_schema(schema, schema, &input);
    let id = body_id(&input, "taskId")?;
    let mut unit = if name == "prepare_execution" {
        repository
            .read(&Command {
                operation: "getTask".into(),
                params: BTreeMap::from([("taskId".into(), id.to_string())]),
                query: BTreeMap::new(),
                body: Value::Null,
                actor: None,
                expected_version: None,
                idempotency_key: None,
                upload: None,
            })
            .await?
    } else {
        repository.begin().await?
    };
    if name == "prepare_execution" {
        validation?;
        return prepare(
            &mut unit,
            id,
            input["offset"].as_u64().unwrap_or(0),
            input["limit"].as_u64().unwrap_or(50),
        )
        .await;
    }
    let actor: Actor = serde_json::from_value(input["actor"].clone())
        .map_err(|_| Failure::new("invalid_actor_context", "Invalid actor"))?;
    actor.validate()?;
    if let Some(id) = actor.id {
        active(&unit.records, "agents", id)?;
    }
    let key = Uuid::parse_str(
        input["idempotencyKey"]
            .as_str()
            .ok_or_else(|| Failure::invalid("Idempotency key required"))?,
    )
    .map_err(|_| Failure::invalid("Invalid idempotency key"))?;
    let hash = Sha256::digest(serde_json::to_vec(&input).unwrap())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    let operation = format!("{name}:{id}");
    if let Some(mut result) = unit.replay(&actor.key(), &operation, key, &hash).await? {
        fill_legacy_task_fields(&mut result.data);
        fill_legacy_slugs(&mut result.data, &unit.records);
        return Ok(result.data);
    }
    if name == "close_activity" {
        crate::dto::usage::require_report(&input["execution"])?;
    }
    validation?;
    check_version(
        unit.records.get("tasks", id)?,
        input["expectedVersion"].as_i64(),
    )?;
    let mut updated = BTreeSet::from([id]);
    let mut created_comments = Vec::new();
    if name == "record_progress" {
        let descendants = hierarchy::descendants(&unit.records, id)?;
        let updates = input["subtaskUpdates"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        for update in &updates {
            let tid = body_id(update, "taskId")?;
            if tid == id || !descendants.contains(&tid) || !updated.insert(tid) {
                return Err(Failure::invalid(
                    "subtaskUpdates must name unique descendants",
                ));
            }
            check_version(
                unit.records.get("tasks", tid)?,
                update["expectedVersion"].as_i64(),
            )?;
        }
        let mut changed =
            update_parts(&mut unit, &actor, key, id, &input, &mut created_comments).await?;
        for update in updates {
            changed |= update_parts(
                &mut unit,
                &actor,
                key,
                body_id(&update, "taskId")?,
                &update,
                &mut created_comments,
            )
            .await?;
        }
        if !changed {
            return Err(Failure::invalid(
                "At least one currentSummary, progress, comment or block update is required",
            ));
        }
    } else if name == "close_activity" {
        update_parts(&mut unit, &actor, key, id, &input, &mut created_comments).await?;
        apply(
            &mut unit,
            &actor,
            key,
            id,
            "createExecutionSummary",
            input["execution"].clone(),
        )
        .await?;
    } else {
        return Err(Failure::missing());
    }
    let data = json!({"createdComments":created_comments,"task":task_value(&unit,id)?,"updatedTasks":updated.into_iter().map(|id|task_value(&unit,id)).collect::<Result<Vec<_>>>()?,"notice":"Stored atomically. No external execution, approval or chat control performed."});
    unit.save_replay(
        &actor.key(),
        &operation,
        key,
        &hash,
        &Outcome::data(data.clone()),
    )
    .await?;
    unit.commit().await?;
    Ok(data)
}
fn task_value(unit: &UnitOfWork, id: Uuid) -> Result<Value> {
    let doc = &contracts::operation("getTask")?.document;
    Ok(project(
        doc,
        &doc["components"]["schemas"]["Task"],
        &queries::resource(&unit.records, "tasks", id)?,
    ))
}
pub(super) async fn prepare(
    unit: &mut UnitOfWork,
    id: Uuid,
    offset: u64,
    limit: u64,
) -> Result<Value> {
    let task = task_value(unit, id)?;
    let executor = value_id(&task["executorAgentId"])?;
    let ra = &contracts::operation("getAgent")?.document;
    let profile = project(
        ra,
        &ra["components"]["schemas"]["Agent"],
        &queries::resource(&unit.records, "agents", executor)?,
    );
    let command = |operation: &str,
                   params: BTreeMap<String, String>,
                   query: BTreeMap<String, Value>| Command {
        operation: operation.into(),
        params,
        query,
        body: json!({}),
        actor: None,
        expected_version: None,
        idempotency_key: None,
        upload: None,
    };
    let plans = queries::run(
        unit,
        &command(
            "listPlans",
            BTreeMap::from([("taskId".into(), id.to_string())]),
            BTreeMap::from([
                ("offset".into(), json!(offset)),
                ("limit".into(), json!(limit)),
                ("sortBy".into(), json!("createdAt")),
            ]),
        ),
    )
    .await?;
    let children = queries::run(
        unit,
        &command(
            "listAllTasks",
            BTreeMap::new(),
            BTreeMap::from([
                ("parentId".into(), json!(id)),
                ("offset".into(), json!(offset)),
                ("limit".into(), json!(limit)),
            ]),
        ),
    )
    .await?;
    let summary = if let Some(sid) = unit
        .records
        .get("tasks", id)?
        .reference("latestExecutionSummaryId")
    {
        unit.records.get("execution_summaries", sid)?.value()
    } else {
        Value::Null
    };
    let doc = &contracts::operation("getTask")?.document;
    Ok(
        json!({"task":task,"executorProfile":profile,"plans":project(doc,&doc["components"]["schemas"]["PlanRevisionPage"],&plans),"children":project(doc,&doc["components"]["schemas"]["TaskPage"],&children),"latestExecutionSummary":if summary.is_null(){Value::Null}else{project(doc,&doc["components"]["schemas"]["ExecutionSummary"],&summary)},"pending":summary.get("pending").cloned().unwrap_or(json!([])),"executionContext":task["executionContext"],"notice":"Read-only preparation. Execute only through the external harness according to the effective origin context and user instructions."}),
    )
}
async fn update_parts(
    unit: &mut UnitOfWork,
    actor: &Actor,
    key: Uuid,
    id: Uuid,
    input: &Value,
    created_comments: &mut Vec<Value>,
) -> Result<bool> {
    let mut changed = false;
    let mut patch = serde_json::Map::new();
    for field in ["progress", "currentSummary"] {
        if let Some(value) = input.get(field) {
            patch.insert(field.into(), value.clone());
        }
    }
    if !patch.is_empty() {
        apply(unit, actor, key, id, "updateTask", Value::Object(patch)).await?;
        changed = true;
    }
    for (field, operation) in [("block", "blockTask"), ("comment", "createComment")] {
        if let Some(value) = input.get(field) {
            let body = match field {
                "comment" => json!({"body":value}),
                _ => value.clone(),
            };
            let result = apply(unit, actor, key, id, operation, body).await?;
            if field == "comment" {
                created_comments.push(json!({"taskId":id,"commentId":result.created_id}));
            }
            changed = true;
        }
    }
    Ok(changed)
}
async fn apply(
    unit: &mut UnitOfWork,
    actor: &Actor,
    key: Uuid,
    id: Uuid,
    operation: &str,
    body: Value,
) -> Result<Outcome> {
    let c = Command {
        operation: operation.into(),
        params: BTreeMap::from([("taskId".into(), id.to_string())]),
        query: BTreeMap::new(),
        body,
        actor: Some(actor.clone()),
        expected_version: Some(unit.records.get("tasks", id)?.version),
        idempotency_key: Some(key),
        upload: None,
    };
    contracts::validate(&c)?;
    kanban::run(unit, &c).await
}
