//! Resolve task-local repository references into immutable historical summary snapshots.
use crate::dto::{
    backend::{Failure, Result},
    work_scope,
};
use serde_json::Value;
use std::collections::BTreeSet;
pub(super) fn snapshot(task: &Value, body: &Value) -> Result<Value> {
    work_scope::require_commit_report(body)?;
    let mut report = body["commitReport"].clone();
    let mut seen = BTreeSet::new();
    for commit in report["commits"].as_array_mut().unwrap() {
        let key = commit["repositoryKey"].as_str().unwrap();
        let repo=task["workScope"]["repositories"].as_array().and_then(|repos|repos.iter().find(|r|r["key"]==key)).ok_or_else(||Failure::invalid("Commit repositoryKey must resolve in the task's explicit workScope.repositories"))?;
        work_scope::commit(commit, repo)?;
        let hash = commit["hash"].as_str().unwrap().to_ascii_lowercase();
        if !seen.insert((key.to_owned(), hash.clone())) {
            return Err(Failure::invalid(
                "Duplicate repository/hash commit reference",
            ));
        }
        commit["hash"] = Value::String(hash);
        commit["repository"] = repo.clone();
    }
    Ok(report)
}
