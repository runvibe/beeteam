use std::sync::Arc;

use crate::repositories::database::DatabaseRepository;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<SharedState>,
    transfers: Option<Arc<crate::services::data_transfer::service::TransferService>>,
}

struct SharedState {
    backend: crate::services::backend::service::BackendService,
    changes: crate::services::changes::ChangeFeed,
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
        let (resources, source) = database.stores();
        let changes = crate::services::changes::ChangeFeed::new(source);
        let backend = crate::services::backend::service::BackendService::new(resources, discovery);
        let inner = SharedState { backend, changes };
        Self {
            inner: Arc::new(inner),
            transfers: None,
        }
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
