use std::sync::Arc;

use crate::repositories::database::DatabaseRepository;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<SharedState>,
}

struct SharedState {
    backend: crate::services::backend::service::BackendService,
    changes: crate::services::changes::ChangeFeed,
}

impl AppState {
    pub fn new(database: DatabaseRepository) -> Self {
        let changes = crate::services::changes::ChangeFeed::new(Arc::new(
            crate::repositories::changes::ChangeRepository::new(database.pool()),
        ));
        let backend = crate::services::backend::service::BackendService::new(Arc::new(
            crate::repositories::resources::ResourceRepository::new(database.pool()),
        ));
        let inner = SharedState { backend, changes };
        Self {
            inner: Arc::new(inner),
        }
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
