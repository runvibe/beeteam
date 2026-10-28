use crate::{
    dto::backend::{Failure, Result},
    repositories::resources::Records,
};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use uuid::Uuid;

pub fn effective_mode(origin: &str, task: &str) -> Result<&'static str> {
    match (origin, task) {
        ("manual", _) => Ok("manual"),
        ("automatic", _) => Ok("automatic"),
        ("standard", "manual") => Ok("manual"),
        ("standard", "automatic") => Ok("automatic"),
        _ => Err(Failure::invalid("Invalid autonomy mode")),
    }
}
pub fn chain(records: &Records, id: Uuid) -> Result<Vec<Uuid>> {
    let mut ids = Vec::new();
    let mut seen = BTreeSet::new();
    let mut next = Some(id);
    while let Some(id) = next {
        if !seen.insert(id) {
            return Err(Failure::new("hierarchy_cycle", "Cycle in task hierarchy"));
        }
        let task = records.get("tasks", id)?;
        ids.push(id);
        next = task.reference("parentId");
    }
    Ok(ids)
}
pub fn context(records: &Records, id: Uuid) -> Result<Value> {
    let task = records.get("tasks", id)?;
    let ancestors = chain(records, id)?;
    let root = *ancestors.last().ok_or_else(Failure::missing)?;
    let origin = records
        .get("tasks", root)?
        .reference("boardId")
        .ok_or_else(Failure::missing)?;
    if task.reference("rootTaskId") != Some(root) || task.reference("originBoardId") != Some(origin)
    {
        return Err(Failure::new(
            "execution_context_mismatch",
            "Stored execution context does not match ancestry",
        ));
    }
    let board = records.get("boards", origin)?;
    let mode = board.data["autonomyMode"].as_str().unwrap_or("manual");
    Ok(
        json!({"rootTaskId":root,"originBoardId":origin,"originBoardMode":mode,"effectiveMode":effective_mode(mode,task.data["autonomyMode"].as_str().unwrap_or("manual"))?}),
    )
}
pub fn descendants(records: &Records, id: Uuid) -> Result<BTreeSet<Uuid>> {
    records.get("tasks", id)?;
    let mut all = BTreeSet::from([id]);
    let mut queue = vec![id];
    while let Some(parent) = queue.pop() {
        for child in records
            .list("tasks")
            .into_iter()
            .filter(|t| t.reference("parentId") == Some(parent))
        {
            if !all.insert(child.id) {
                return Err(Failure::new("hierarchy_cycle", "Cycle in task hierarchy"));
            }
            queue.push(child.id);
        }
    }
    Ok(all)
}
pub(super) fn writable(records: &Records, id: Uuid, restoring: bool) -> Result<()> {
    for ancestor in chain(records, id)? {
        let task = records.get("tasks", ancestor)?;
        super::active(records, "boards", task.reference("boardId").unwrap())?;
        if task.archived_at.is_some() && !(restoring && ancestor == id) {
            return Err(Failure::new(
                "archived_resource",
                "Task or ancestor is archived",
            ));
        }
    }
    Ok(())
}
pub(super) fn archived(records: &Records, id: Uuid) -> Result<bool> {
    for ancestor in chain(records, id)? {
        let task = records.get("tasks", ancestor)?;
        if task.archived_at.is_some()
            || records
                .get("boards", task.reference("boardId").unwrap())?
                .archived_at
                .is_some()
        {
            return Ok(true);
        }
    }
    Ok(false)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origin_mode_overrides_destination_and_never_inherits_parent_flag() {
        for origin in ["manual", "standard", "automatic"] {
            for task in ["manual", "automatic"] {
                for _destination in ["manual", "standard", "automatic"] {
                    for _parent in ["manual", "automatic"] {
                        let expected = if origin == "standard" { task } else { origin };
                        assert_eq!(effective_mode(origin, task).unwrap(), expected);
                    }
                }
            }
        }
    }
}
