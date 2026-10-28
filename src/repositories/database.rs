use sqlx::PgPool;

#[derive(Clone)]
pub struct DatabaseRepository {
    pool: PgPool,
}

impl DatabaseRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub(crate) fn pool(&self) -> PgPool {
        self.pool.clone()
    }
}

use anyhow::{Context, Result};
use sqlx::postgres::PgPoolOptions;

pub type DbPool = PgPool;

pub async fn init_pool(database_url: &str) -> Result<DbPool> {
    PgPoolOptions::new()
        .max_connections(16)
        .connect(database_url)
        .await
        .context("failed to connect to postgres")
}

pub async fn run_migrations(pool: &DbPool) -> Result<()> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .context("failed to run database migrations")
}
