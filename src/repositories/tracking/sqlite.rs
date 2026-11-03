use super::Aggregate;
use crate::{
    dto::backend::{Command, Result},
    repositories::records::{Records, Selection},
};
use futures_util::TryStreamExt;
use serde_json::Value;
use sqlx::{Row, Sqlite, Transaction};
pub(crate) async fn select(tx: &mut Transaction<'_, Sqlite>, c: &Command) -> Result<Selection> {
    let id = c.id("taskId")?.to_string();
    let mut stats = Aggregate::default();
    {
        let mut rows=sqlx::query("SELECT data FROM task_execution_intervals WHERE task_id=$1 AND deleted_at IS NULL ORDER BY data->>'startObservedAt',id").bind(id.clone()).fetch(&mut **tx);
        while let Some(row) = rows.try_next().await? {
            stats.push(
                &(serde_json::from_str::<Value>(&row.get::<String, _>("data")).map_err(|_| {
                    crate::dto::backend::Failure::invalid("Invalid stored interval")
                })?),
            )?;
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
