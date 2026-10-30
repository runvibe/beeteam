use sqlx::PgPool;

#[derive(Clone)]
pub struct DatabaseRepository {
    pool: DatabasePool,
}

impl DatabaseRepository {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: DatabasePool::Postgres(pool),
        }
    }

    pub async fn connect(driver: crate::config::DatabaseDriver, url: &str) -> Result<Self> {
        match driver {
            crate::config::DatabaseDriver::Postgres => {
                let pool = init_pool(url).await?;
                run_migrations(&pool).await?;
                Ok(Self::new(pool))
            }
            crate::config::DatabaseDriver::Sqlite => {
                let pool = super::sqlite::connect(url).await?;
                Ok(Self {
                    pool: DatabasePool::Sqlite(pool),
                })
            }
        }
    }
    pub fn transfers(&self) -> std::sync::Arc<dyn super::transfer::contracts::TransferDatabase> {
        match &self.pool {
            DatabasePool::Postgres(pool) => std::sync::Arc::new(
                super::transfer::postgres::TransferRepository::new(pool.clone()),
            ),
            DatabasePool::Sqlite(pool) => std::sync::Arc::new(
                super::transfer::sqlite::TransferRepository::new(pool.clone()),
            ),
        }
    }
    pub fn stores(
        &self,
    ) -> (
        std::sync::Arc<dyn super::contracts::ResourceStore>,
        std::sync::Arc<dyn super::contracts::ChangeSource>,
    ) {
        match &self.pool {
            DatabasePool::Postgres(pool) => (
                std::sync::Arc::new(super::resources::ResourceRepository::new(pool.clone())),
                std::sync::Arc::new(super::changes::ChangeRepository::new(pool.clone())),
            ),
            DatabasePool::Sqlite(pool) => (
                std::sync::Arc::new(super::sqlite::ResourceRepository::new(pool.clone())),
                std::sync::Arc::new(super::sqlite::changes::ChangeRepository::new(pool.clone())),
            ),
        }
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

#[derive(Clone)]
enum DatabasePool {
    Postgres(PgPool),
    Sqlite(sqlx::SqlitePool),
}
