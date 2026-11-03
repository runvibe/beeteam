use crate::{
    dto::{
        backend::{Command, Failure, Result},
        local_projects::{OpenProjectRequest, OpenProjectResponse},
    },
    repositories::contracts::{ProjectOpener, ResourceStore},
};
use serde_json::Value;
use std::{collections::BTreeMap, sync::Arc};
use uuid::Uuid;

pub struct LocalProjectService {
    repository: Arc<dyn ResourceStore>,
    opener: Arc<dyn ProjectOpener>,
}
impl LocalProjectService {
    pub fn new(repository: Arc<dyn ResourceStore>, opener: Arc<dyn ProjectOpener>) -> Self {
        Self { repository, opener }
    }
    pub async fn open(
        &self,
        task_id: Uuid,
        project_key: String,
        input: OpenProjectRequest,
    ) -> Result<OpenProjectResponse> {
        if project_key.is_empty()
            || project_key.len() > 200
            || project_key.chars().any(char::is_control)
        {
            return Err(Failure::invalid("Chave de projeto inválida."));
        }
        let command = Command {
            operation: "getTask".into(),
            params: BTreeMap::from([("taskId".into(), task_id.to_string())]),
            query: BTreeMap::new(),
            body: Value::Null,
            actor: None,
            expected_version: None,
            idempotency_key: None,
            upload: None,
        };
        // Reuse the repository-owned bounded, read-only snapshot. No write lock.
        let snapshot = self.repository.read(&command).await?;
        let task = snapshot.records.get("tasks", task_id)?;
        let root = task.data["workScope"]["projects"]
            .as_array()
            .and_then(|projects| {
                projects
                    .iter()
                    .find(|p| p["key"].as_str() == Some(&project_key))
            })
            .and_then(|project| project["rootPath"].as_str())
            .ok_or_else(|| {
                Failure::new("project_not_found", "Projeto não encontrado nesta tarefa.")
            })?
            .to_owned();
        snapshot.rollback().await?;
        self.opener.open(&root, input.application).await?;
        Ok(OpenProjectResponse {
            project_key,
            application: input.application,
            outcome: "requested",
        })
    }
}
