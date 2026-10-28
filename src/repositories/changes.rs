use super::contracts::{ChangeSource, ChangeStream, RepositoryFuture};
use sqlx::{postgres::PgListener, PgPool, Postgres, Transaction};
pub const CHANNEL: &str = "beeteam_changes";
pub async fn notify(tx: &mut Transaction<'_, Postgres>) -> Result<(), sqlx::Error> {
    // PostgreSQL delivers NOTIFY only after successful commit, including deferred constraints.
    sqlx::query("SELECT pg_notify($1, '')")
        .bind(CHANNEL)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
pub struct ChangeRepository {
    pool: PgPool,
}
impl ChangeRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    pub fn is_closed(&self) -> bool {
        self.pool.is_closed()
    }
    pub async fn connect(&self) -> Result<ChangeListener, sqlx::Error> {
        ChangeListener::connect(&self.pool).await
    }
}
pub struct ChangeListener(PgListener);
impl ChangeListener {
    pub async fn connect(pool: &PgPool) -> Result<Self, sqlx::Error> {
        let mut listener = PgListener::connect_with(pool).await?;
        listener.listen(CHANNEL).await?;
        Ok(Self(listener))
    }
    pub async fn next(&mut self) -> Result<bool, sqlx::Error> {
        Ok(self.0.try_recv().await?.is_some())
    }
}

impl ChangeSource for ChangeRepository {
    fn is_closed(&self) -> bool {
        self.pool.is_closed()
    }
    fn connect(&self) -> RepositoryFuture<'_, Box<dyn ChangeStream>> {
        Box::pin(async move {
            Ok(Box::new(ChangeListener::connect(&self.pool).await?) as Box<dyn ChangeStream>)
        })
    }
}
impl ChangeStream for ChangeListener {
    fn next(&mut self) -> RepositoryFuture<'_, bool> {
        Box::pin(async move { Ok(ChangeListener::next(self).await?) })
    }
}
