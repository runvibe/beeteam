//! Committed change-clock polling also observes writes from other processes.
use super::super::contracts::{ChangeSource, ChangeStream, RepositoryFuture};
use sqlx::SqlitePool;
use std::time::Duration;
pub struct ChangeRepository {
    pool: SqlitePool,
}
impl ChangeRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}
struct Listener {
    pool: SqlitePool,
    last: i64,
}
impl ChangeSource for ChangeRepository {
    fn is_closed(&self) -> bool {
        self.pool.is_closed()
    }
    fn connect(&self) -> RepositoryFuture<'_, Box<dyn ChangeStream>> {
        Box::pin(async move {
            let last = sqlx::query_scalar("SELECT changes FROM beeteam_clock WHERE id=1")
                .fetch_one(&self.pool)
                .await?;
            Ok(Box::new(Listener {
                pool: self.pool.clone(),
                last,
            }) as Box<dyn ChangeStream>)
        })
    }
}
impl ChangeStream for Listener {
    fn next(&mut self) -> RepositoryFuture<'_, bool> {
        Box::pin(async move {
            loop {
                tokio::time::sleep(Duration::from_millis(200)).await;
                let current: i64 =
                    sqlx::query_scalar("SELECT changes FROM beeteam_clock WHERE id=1")
                        .fetch_one(&self.pool)
                        .await?;
                if current != self.last {
                    self.last = current;
                    return Ok(true);
                }
            }
        })
    }
}
