use std::sync::Arc;

use crate::repositories::database::DatabaseRepository;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<SharedState>,
}

struct SharedState {
    pub database: DatabaseRepository,
    changes: crate::services::changes::ChangeFeed,
}

impl AppState {
    pub fn new(database: DatabaseRepository) -> Self {
        let changes = crate::services::changes::ChangeFeed::new(
            crate::repositories::changes::ChangeRepository::new(database.pool()),
        );
        let inner = SharedState { database, changes };
        Self {
            inner: Arc::new(inner),
        }
    }

    pub fn changes(&self) -> &crate::services::changes::ChangeFeed {
        &self.inner.changes
    }

    pub fn database(&self) -> DatabaseRepository {
        self.inner.database.clone()
    }
}

#[cfg(test)]
mod tests {
    use sqlx::postgres::PgPoolOptions;

    use super::AppState;
    use crate::repositories::database::DatabaseRepository;

    #[tokio::test]
    async fn state_exposes_database_repository() {
        let pool = PgPoolOptions::new().connect_lazy("postgres://postgres:postgres@localhost/test");
        let repository = DatabaseRepository::new(pool.expect("lazy pool"));
        let state = AppState::new(repository.clone());

        let _ = state.database();
    }
}
