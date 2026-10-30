use crate::dto::data_transfer::TimestampPolicy;
use anyhow::{ensure, Context, Result};
use chrono::{DateTime, Timelike, Utc};
use serde_json::Value;
use uuid::Uuid;

pub fn text<'a>(row: &'a Value, key: &str) -> Result<&'a str> {
    row[key].as_str().context("invalid_transfer_field")
}
pub fn id(row: &Value) -> Result<Uuid> {
    let value = Uuid::parse_str(text(row, "id")?)?;
    ensure!(value.get_version_num() == 7, "invalid_uuid");
    Ok(value)
}
pub fn date(row: &Value, key: &str, policy: &TimestampPolicy) -> Result<Option<DateTime<Utc>>> {
    if row[key].is_null() {
        return Ok(None);
    }
    let value = DateTime::parse_from_rfc3339(text(row, key)?)?.with_timezone(&Utc);
    let remainder = value.nanosecond() % 1000;
    ensure!(
        remainder == 0 || *policy == TimestampPolicy::TruncateToMicroseconds,
        "timestamp_precision_loss"
    );
    Ok(Some(
        value
            .with_nanosecond(value.nanosecond() - remainder)
            .context("invalid_timestamp")?,
    ))
}
