//! Read-only reduction of stored canonical deltas, without inferring attribution.
use crate::dto::backend::{Failure, Result};
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub(super) const SQL: &str = "SELECT CAST(entry AS TEXT) AS entry_json FROM summary_usage_entries WHERE task_id=$1 AND entry->'observation'->>'scope'='session' AND entry->'observation'->>'reportKind'='cumulative_snapshot'";

#[derive(Default)]
pub(super) struct RecordedSessions {
    evidence: BTreeSet<String>,
    sessions: BTreeSet<String>,
    measured: Option<u128>,
    estimated: Option<u128>,
    baselines: u64,
    deltas: u64,
    duplicates: u64,
}
impl RecordedSessions {
    pub(super) fn push(&mut self, raw: &str) -> Result<()> {
        let entry: Value = serde_json::from_str(raw)
            .map_err(|_| Failure::new("internal_error", "Invalid stored usage entry"))?;
        self.push_entry(&entry)
    }
    pub(super) fn push_entry(&mut self, entry: &Value) -> Result<()> {
        if entry["observation"]["scope"] != "session"
            || entry["observation"]["reportKind"] != "cumulative_snapshot"
        {
            return Ok(());
        }
        if entry["coverageReason"] == "duplicate_reference" {
            self.duplicates += 1;
            return Ok(());
        }
        let key = entry["evidenceKey"].as_str().ok_or_else(|| {
            Failure::new("internal_error", "Stored usage evidence has no identity")
        })?;
        if !self.evidence.insert(key.to_owned()) {
            self.duplicates += 1;
            return Ok(());
        }
        let observation = &entry["observation"];
        self.sessions
            .insert(json!([observation["source"], observation["sessionId"]]).to_string());
        if entry["delta"].is_null() {
            self.baselines += 1;
            return Ok(());
        }
        self.deltas += 1;
        // Unknown components do not turn a partial measurement into a full total.
        if let Some(total) = entry["delta"]["totalTokens"].as_str() {
            let total: u128 = total
                .parse()
                .map_err(|_| Failure::new("internal_error", "Invalid stored usage total"))?;
            let target = match observation["quality"].as_str() {
                Some("measured") => &mut self.measured,
                Some("estimated") => &mut self.estimated,
                _ => return Ok(()),
            };
            *target = Some(target.unwrap_or(0).checked_add(total).ok_or_else(|| {
                Failure::new("internal_error", "Registered session total overflow")
            })?);
        }
        Ok(())
    }
    pub(super) fn value(self) -> Value {
        json!({
            "measuredTotalTokens":self.measured.map(|n|n.to_string()),
            "estimatedTotalTokens":self.estimated.map(|n|n.to_string()),
            "coverage":{"sessions":self.sessions.len(),"baselineEntries":self.baselines,
                "deltaEntries":self.deltas,"duplicateEntries":self.duplicates}
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn entry(key: &str, scope: &str, total: Value) -> Value {
        json!({"evidenceKey":key,"coverageReason":"shared_or_unallocated","observation":{"source":"source","sessionId":"session","scope":scope,"reportKind":"cumulative_snapshot","quality":"measured"},"delta":{"totalTokens":total}})
    }
    #[test]
    fn recorded_totals_keep_wide_precision_and_deduplicate_canonical_keys() {
        let mut totals = RecordedSessions::default();
        let first = entry("one", "session", json!(i64::MAX.to_string()));
        totals.push_entry(&first).unwrap();
        totals.push_entry(&first).unwrap();
        totals
            .push_entry(&entry("two", "session", json!(i64::MAX.to_string())))
            .unwrap();
        let result = totals.value();
        assert_eq!(result["measuredTotalTokens"], "18446744073709551614");
        assert_eq!(result["coverage"]["deltaEntries"], 2);
        assert_eq!(result["coverage"]["duplicateEntries"], 1);
    }
    #[test]
    fn scopes_baselines_partial_measurements_and_zero_remain_distinct() {
        let mut totals = RecordedSessions::default();
        totals
            .push_entry(&entry("tree", "session_tree", json!("999")))
            .unwrap();
        let mut request = entry("request", "request", json!("999"));
        request["observation"]["reportKind"] = json!("period_delta");
        totals.push_entry(&request).unwrap();
        let mut baseline = entry("base", "session", Value::Null);
        baseline["delta"] = Value::Null;
        totals.push_entry(&baseline).unwrap();
        totals
            .push_entry(&entry("partial", "session", Value::Null))
            .unwrap();
        assert!(totals.measured.is_none());
        assert_eq!(totals.baselines, 1);
        assert_eq!(totals.deltas, 1);
        totals
            .push_entry(&entry("zero", "session", json!("0")))
            .unwrap();
        assert_eq!(totals.value()["measuredTotalTokens"], "0");
    }
}
