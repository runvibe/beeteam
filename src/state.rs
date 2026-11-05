use std::sync::Arc;

use crate::repositories::database::DatabaseRepository;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<SharedState>,
    api_info: crate::services::api_info::ApiInfoService,
    transfers: Option<Arc<crate::services::data_transfer::service::TransferService>>,
}

struct SharedState {
    backend: crate::services::backend::service::BackendService,
    changes: crate::services::changes::ChangeFeed,
    local_projects: crate::services::local_projects::LocalProjectService,
}

impl AppState {
    pub fn new(database: DatabaseRepository) -> Self {
        Self::with_project_discovery(
            database,
            Arc::new(crate::repositories::local_git::LocalGitDiscovery::default()),
        )
    }
    pub fn with_project_discovery(
        database: DatabaseRepository,
        discovery: Arc<dyn crate::repositories::contracts::ProjectDiscovery>,
    ) -> Self {
        Self::with_project_adapters(
            database,
            discovery,
            Arc::new(crate::repositories::local_projects::LocalProjectOpener),
        )
    }
    pub fn with_project_adapters(
        database: DatabaseRepository,
        discovery: Arc<dyn crate::repositories::contracts::ProjectDiscovery>,
        opener: Arc<dyn crate::repositories::contracts::ProjectOpener>,
    ) -> Self {
        let (resources, source) = database.stores();
        let changes = crate::services::changes::ChangeFeed::new(source);
        let local_projects =
            crate::services::local_projects::LocalProjectService::new(resources.clone(), opener);
        let backend = crate::services::backend::service::BackendService::new(resources, discovery);
        let inner = SharedState {
            backend,
            changes,
            local_projects,
        };
        Self {
            inner: Arc::new(inner),
            transfers: None,
            api_info: crate::services::api_info::ApiInfoService::new(false, false, false),
        }
    }

    /// Compose discovery from the same enabled transport/service state as the router.
    pub(crate) fn with_api_info(mut self, mcp_enabled: bool, local_projects_enabled: bool) -> Self {
        self.api_info = crate::services::api_info::ApiInfoService::new(
            mcp_enabled,
            self.transfers.as_ref().is_some_and(|service| service.config.enabled),
            local_projects_enabled,
        );
        self
    }
    pub fn api_info(&self) -> &crate::services::api_info::ApiInfoService {
        &self.api_info
    }

    pub fn with_transfers(
        mut self,
        service: crate::services::data_transfer::service::TransferService,
    ) -> Self {
        self.transfers = Some(Arc::new(service));
        self
    }
    pub fn transfers(
        &self,
    ) -> Option<&Arc<crate::services::data_transfer::service::TransferService>> {
        self.transfers.as_ref()
    }

    pub fn changes(&self) -> &crate::services::changes::ChangeFeed {
        &self.inner.changes
    }

    pub fn backend(&self) -> &crate::services::backend::service::BackendService {
        &self.inner.backend
    }
    pub fn local_projects(&self) -> &crate::services::local_projects::LocalProjectService {
        &self.inner.local_projects
    }
}

#[cfg(test)]
mod tests {
    use sqlx::postgres::PgPoolOptions;

    use super::AppState;
    use crate::repositories::database::DatabaseRepository;

    #[tokio::test]
    async fn state_exposes_backend_service() {
        let pool = PgPoolOptions::new().connect_lazy("postgres://postgres:postgres@localhost/test");
        let repository = DatabaseRepository::new(pool.expect("lazy pool"));
        let state = AppState::new(repository.clone());

        let _ = state.backend();
    }
}
