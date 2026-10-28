//! Compatibility exports; PostgreSQL initialization lives in repositories.
pub use crate::repositories::database::{init_pool, run_migrations, DbPool};
