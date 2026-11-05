//! Atomic hierarchy changes over the existing serialized repository UnitOfWork.
use super::{check_version, coordination, event, hierarchy, outcome};
use crate::{
    dto::{backend::*, task_parent::LinkTaskToParent},
    repositories::contracts::UnitOfWork,
};
use serde_json::json;
use std::collections::BTreeMap;

pub(super) async fn link(unit: &mut UnitOfWork, command: &Command) -> Result<Outcome> {
    let id = command.id("taskId")?;
    let input = LinkTaskToParent::parse(&command.body)?;
    let old = unit.records.get("tasks", id)?.clone();
    check_version(&old, command.expected_version)?;
    hierarchy::writable(&unit.records, id, false)?;
    hierarchy::writable(&unit.records, input.parent_id, false)?;
    let parent = unit.records.get("tasks", input.parent_id)?.clone();
    check_version(&parent, Some(input.parent_version))?;
    let previous_parent = old.reference("parentId");
    if let Some(previous) = previous_parent {
        check_version(
            unit.records.get("tasks", previous)?,
            input.previous_parent_version,
        )?;
    } else if input.previous_parent_version.is_some() {
        return Err(Failure::invalid(
            "previousParentVersion requires an existing parent",
        ));
    }
    let subtree = hierarchy::descendants(&unit.records, id)?;
    if unit.records.rows.values().any(|task| {
        task.table == "tasks"
            && task.deleted_at.is_some()
            && task
                .reference("parentId")
                .is_some_and(|parent| subtree.contains(&parent))
    }) {
        return Err(Failure::new(
            "archived_resource",
            "A deleted descendant prevents changing subtree context",
        ));
    }
    if subtree.contains(&input.parent_id) {
        return Err(Failure::new(
            "hierarchy_cycle",
            "A task cannot be linked to itself or its descendants",
        ));
    }
    let destination = hierarchy::context(&unit.records, input.parent_id)?;
    let mut manual = destination["effectiveMode"] == "manual";
    if let Some(previous) = previous_parent {
        manual |= hierarchy::context(&unit.records, previous)?["effectiveMode"] == "manual";
    }
    let mut contexts = BTreeMap::new();
    for task_id in &subtree {
        hierarchy::writable(&unit.records, *task_id, false)?;
        let context = hierarchy::context(&unit.records, *task_id)?;
        let task_mode = unit.records.get("tasks", *task_id)?.data["autonomyMode"]
            .as_str()
            .unwrap_or("manual");
        let new_mode =
            hierarchy::effective_mode(destination["originBoardMode"].as_str().unwrap(), task_mode)?;
        manual |= context["effectiveMode"] == "manual" || new_mode == "manual";
        contexts.insert(*task_id, context);
    }
    coordination(
        &json!({"coordinationContext":input.coordination_context}),
        if manual { "manual" } else { "automatic" },
    )?;
    // A new key for an already established link is a validated no-op; exact replay
    // is handled earlier by the common service and retains its original snapshot.
    if previous_parent == Some(input.parent_id) {
        return outcome(&unit.records, "tasks", id, false);
    }
    if unit
        .records
        .list("task_execution_intervals")
        .iter()
        .any(|interval| {
            interval.data["state"] == "open"
                && interval
                    .reference("taskId")
                    .is_some_and(|task| subtree.contains(&task))
        })
    {
        return Err(Failure::new(
            "active_execution_interval",
            "Pause or finish open subtree intervals before changing hierarchy",
        ));
    }
    for task_id in &subtree {
        let task = unit.records.get_mut("tasks", *task_id)?;
        if *task_id == id {
            task.data["parentId"] = json!(input.parent_id);
        }
        task.data["rootTaskId"] = destination["rootTaskId"].clone();
        task.data["originBoardId"] = destination["originBoardId"].clone();
        task.touch();
    }
    unit.records.get_mut("tasks", input.parent_id)?.touch();
    if let Some(previous) = previous_parent {
        unit.records.get_mut("tasks", previous)?.touch();
    }
    // Append audit to each affected task; never rewrite historical summaries,
    // interval observations, plans, comments, attachments or replay snapshots.
    for (task_id, previous_context) in contexts {
        let current = hierarchy::context(&unit.records, task_id)?;
        event(
            unit,
            command,
            task_id,
            "task.parent_changed",
            json!({
                "linkedTaskId":id,"previousParentId":previous_parent,"parentId":input.parent_id,
                "previousExecutionContext":previous_context,"executionContext":current,
                "coordinationContext":input.coordination_context
            }),
        )
        .await?;
    }
    outcome(&unit.records, "tasks", id, false)
}
