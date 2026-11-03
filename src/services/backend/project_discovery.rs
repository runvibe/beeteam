//! Derive repository scope from explicit projects, outside persistence transactions.
use crate::{
    dto::{
        backend::{Failure, Result},
        work_scope,
    },
    repositories::contracts::ProjectDiscovery,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub(super) async fn scope(discovery: &dyn ProjectDiscovery, input: &Value) -> Result<Value> {
    work_scope::require_projects(input)?;
    let mut projects = input["projects"].as_array().unwrap().clone();
    let roots: Vec<_> = projects
        .iter()
        .map(|p| p["rootPath"].as_str().unwrap().to_owned())
        .collect();
    let observations = discovery.discover(&roots).await;
    if observations.len() != projects.len() {
        return Err(Failure::new(
            "internal_error",
            "Discovery adapter returned an incomplete observation list",
        ));
    }
    let mut repositories: BTreeMap<String, Value> = BTreeMap::new();
    for (project, mut observation) in projects.iter_mut().zip(observations) {
        if observation.status == "detected" {
            let common = observation.common_directory.as_deref().ok_or_else(|| {
                Failure::new(
                    "internal_error",
                    "Detected checkout missing common directory",
                )
            })?;
            let key = format!(
                "git-{}",
                Sha256::digest(common.as_bytes())
                    .iter()
                    .map(|b| format!("{b:02x}"))
                    .collect::<String>()
            );
            observation.repository_key = Some(key.clone());
            let selected = observation
                .remotes
                .iter()
                .find(|r| r.name == "origin")
                .or_else(|| observation.remotes.first());
            let remote = selected.and_then(|r| r.url.clone());
            let (provider, web) = web_repository(remote.as_deref());
            let repository=repositories.entry(key.clone()).or_insert_with(||json!({"key":key,"name":project["name"],"remoteUrl":remote,"webUrl":web,"provider":provider,"projectKeys":[]}));
            repository["projectKeys"]
                .as_array_mut()
                .unwrap()
                .push(project["key"].clone());
        }
        project["discovery"] = serde_json::to_value(observation)
            .map_err(|_| Failure::new("internal_error", "Invalid discovery observation"))?;
    }
    Ok(
        json!({"status":"identified","projects":projects,"repositories":repositories.into_values().collect::<Vec<_>>()}),
    )
}
fn web_repository(remote: Option<&str>) -> (&'static str, Option<String>) {
    let Some(remote) = remote else {
        return ("other", None);
    };
    let Ok(url) = url::Url::parse(remote) else {
        return ("other", None);
    };
    // Recognize only public providers and their ordinary transport ports.
    let host = url.host_str().unwrap_or("");
    let provider = match host {
        "github.com" => "github",
        "gitlab.com" => "gitlab",
        _ => return ("other", None),
    };
    if url.port().is_some() && !(url.scheme() == "ssh" && url.port() == Some(22)) {
        return ("other", None);
    }
    let path = url.path().trim_end_matches('/').trim_end_matches(".git");
    let pieces: Vec<_> = path.trim_start_matches('/').split('/').collect();
    if pieces.len() < 2
        || (provider == "github" && pieces.len() != 2)
        || pieces
            .iter()
            .any(|p| p.is_empty() || *p == "." || *p == "..")
    {
        return ("other", None);
    }
    (provider, Some(format!("https://{host}{path}")))
}
