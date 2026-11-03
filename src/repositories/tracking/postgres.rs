use super::Aggregate;
use crate::{
    dto::backend::{Command, Result},
    repositories::records::{Records, Selection},
};
use futures_util::TryStreamExt;
use serde_json::Value;
use sqlx::{Postgres, Row, Transaction};
pub(crate) async fn select(tx: &mut Transaction<'_, Postgres>, c: &Command) -> Result<Selection> {
    let id = c.id("taskId")?;
    let mut stats = Aggregate::default();
    {
        let mut rows=sqlx::query("SELECT data FROM task_execution_intervals WHERE task_id=$1 AND deleted_at IS NULL ORDER BY data->>'startObservedAt',id").bind(id.clone()).fetch(&mut **tx);
        while let Some(row) = rows.try_next().await? {
            stats.push(&(row.get::<Value, _>("data")))?;
        }
    }
    let untracked:i64=sqlx::query_scalar("SELECT count(*) FROM execution_summaries WHERE task_id=$1 AND deleted_at IS NULL AND data->>'executionTracking' IS NULL").bind(id).fetch_one(&mut **tx).await?;
    Ok(Selection {
        items: vec![stats.value(untracked)],
        total: 1,
        offset: 0,
        limit: 1,
        records: Records::default(),
        table: "tracking",
    })
}
