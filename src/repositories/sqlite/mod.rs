//! SQLite adapters. Driver details never escape the repository boundary.
pub mod changes;
mod query;
mod reads;
mod resources;
mod slugs;
use anyhow::{Context, Result};
pub use resources::ResourceRepository;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use std::{str::FromStr, time::Duration};

pub async fn connect(url: &str) -> Result<SqlitePool> {
    let options = SqliteConnectOptions::from_str(url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(30))
        .with_regexp()
        .collation("beeteam_nocase", |a, b| {
            a.to_lowercase().cmp(&b.to_lowercase())
        });
    let pool = SqlitePoolOptions::new()
        .max_connections(16)
        .connect_with(options)
        .await
        .context("failed to connect to SQLite")?;
    sqlx::migrate!("./migrations/sqlite")
        .run(&pool)
        .await
        .context("failed to migrate SQLite")?;
    Ok(pool)
}
