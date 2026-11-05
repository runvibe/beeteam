//! Persistence order for immediate parent-context constraints in both drivers.
use super::records::{Record, Records};
use crate::dto::backend::{Failure, Result};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

pub(super) fn tasks(records: &Records) -> Result<Vec<&Record>> {
    let tasks: BTreeMap<_, _> = records
        .rows
        .values()
        .filter(|r| r.table == "tasks")
        .map(|r| (r.id, r))
        .collect();
    let mut children: BTreeMap<Uuid, Vec<Uuid>> = BTreeMap::new();
    let mut ready = BTreeSet::new();
    for task in tasks.values() {
        if let Some(parent) = task.reference("parentId") {
            if !tasks.contains_key(&parent) {
                return Err(Failure::missing());
            }
            children.entry(parent).or_default().push(task.id);
        } else {
            ready.insert(task.id);
        }
    }
    let mut ordered = Vec::with_capacity(tasks.len());
    while let Some(id) = ready.pop_first() {
        ordered.push(tasks[&id]);
        if let Some(ids) = children.remove(&id) {
            ready.extend(ids);
        }
    }
    if ordered.len() != tasks.len() {
        return Err(Failure::new(
            "hierarchy_cycle",
            "Cycle in persisted task hierarchy",
        ));
    }
    Ok(ordered)
}
