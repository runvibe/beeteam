//! Streaming read aggregates, independent of page size, inside repository snapshots.
pub(super) mod postgres;
pub(super) mod sqlite;
use crate::dto::{
    backend::{Failure, Result},
    usage::counter,
};
use serde_json::{json, Value};
#[derive(Default)]
struct Aggregate {
    valid: Option<i64>,
    partial: Option<i64>,
    duration: Option<i64>,
    elapsed: Option<i64>,
    union_end: Option<chrono::DateTime<chrono::FixedOffset>>,
    total: u64,
    closed: u64,
    open: u64,
    incomplete: u64,
    invalid: u64,
}
fn add(target: &mut Option<i64>, n: i64) -> Result<()> {
    *target = Some(
        target
            .unwrap_or(0)
            .checked_add(n)
            .ok_or_else(|| Failure::invalid("Interval aggregate overflow"))?,
    );
    Ok(())
}
impl Aggregate {
    fn push(&mut self, v: &Value) -> Result<()> {
        self.total += 1;
        match v["state"].as_str() {
            Some("closed") => self.closed += 1,
            Some("open") => self.open += 1,
            Some("incomplete") => self.incomplete += 1,
            _ => self.invalid += 1,
        };
        if let Some(n) = counter(&v["totalTokens"])? {
            add(&mut self.valid, n)?;
        }
        if let Some(n) = counter(&v["partialTokens"])? {
            add(&mut self.partial, n)?;
        }
        if v["state"] != "open" && v["state"] != "invalid" {
            if let Some(n) = counter(&v["observedDurationMs"])? {
                add(&mut self.duration, n)?;
            }
            let parse = |key: &str| {
                chrono::DateTime::parse_from_rfc3339(v[key].as_str().unwrap_or(""))
                    .map_err(|_| Failure::invalid("Invalid stored boundary time"))
            };
            let start = parse("startObservedAt")?;
            let end = parse("endObservedAt")?;
            let uncovered = self.union_end.map(|old| old.max(start)).unwrap_or(start);
            add(
                &mut self.elapsed,
                (end - uncovered).num_milliseconds().max(0),
            )?;
            self.union_end = Some(self.union_end.map(|old| old.max(end)).unwrap_or(end));
        }
        Ok(())
    }
    fn value(&self, untracked: i64) -> Value {
        let decimal = |n: Option<i64>| n.map(|v| json!(v.to_string())).unwrap_or(Value::Null);
        json!({"validTotalTokens":decimal(self.valid),"partialTotalTokens":decimal(self.partial),"observedDurationMs":decimal(self.duration),"elapsedDurationMs":decimal(self.elapsed),"coverage":{"totalIntervals":self.total,"validIntervals":self.closed,"openIntervals":self.open,"incompleteIntervals":self.incomplete,"invalidIntervals":self.invalid,"untrackedSummaries":untracked}})
    }
}
