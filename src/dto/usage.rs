//! Transport-independent validation for required new-write, evidence-backed summary usage.
use super::backend::{value_id, Failure, Result};
use chrono::DateTime;
use serde_json::Value;

/// Enforced after replay lookup so historical successful requests stay replayable.
pub fn require_report(body: &Value) -> Result<()> {
    let entries = body
        .get("usageReport")
        .and_then(|v| v.get("entries"))
        .and_then(Value::as_array)
        .filter(|entries| !entries.is_empty())
        .ok_or_else(|| Failure::invalid(NEW_SUMMARY_USAGE))?;
    for entry in entries {
        if entry["reportKind"] != "cumulative_snapshot"
            || !matches!(entry["scope"].as_str(), Some("session" | "session_tree"))
            || entry["quality"] != "measured"
            || entry["actor"]["kind"] != "agent"
            || entry["modelId"]
                .as_str()
                .is_none_or(|model| model.trim().is_empty())
        {
            return Err(Failure::invalid(NEW_SUMMARY_USAGE));
        }
        value_id(&entry["actor"]["id"]).map_err(|_| Failure::invalid(NEW_SUMMARY_USAGE))?;
        validate_total(entry).map_err(|_| Failure::invalid(NEW_SUMMARY_USAGE))?;
    }
    Ok(())
}

pub const NEW_SUMMARY_USAGE: &str = "Every new summary requires usageReport.entries with measured cumulative_snapshot usage for session/session_tree, an identified modelId and actor.kind=agent with persisted UUIDv7. Supply non-null decimal-string totalTokens=inputTokens+outputTokens (inclusive); never add cache/reasoning twice. A first real snapshot is accepted without a predecessor or delta. Collect from the actual session's permitted harness API/stream/export; no unavailable, estimated, missing counters or fabricated zero. If collection fails, report the impediment in a comment; do not change status or claim the summary was saved. Historical records and exact saved replays remain valid.";

fn validate_total(entry: &Value) -> Result<()> {
    let input = counter(&entry["inputTokens"])?;
    let output = counter(&entry["outputTokens"])?;
    let total = counter(&entry["totalTokens"])?;
    match (input,output,total) {
        (Some(input),Some(output),Some(total)) if input.checked_add(output)==Some(total)=>Ok(()),
        _=>Err(Failure::invalid("totalTokens must equal inclusive inputTokens + outputTokens without adding cache/reasoning subsets")),
    }
}

pub const COMPONENTS: [&str; 4] = [
    "inputTokens",
    "outputTokens",
    "cachedInputTokens",
    "reasoningOutputTokens",
];

pub fn counter(value: &Value) -> Result<Option<i64>> {
    if value.is_null() {
        return Ok(None);
    }
    let text = value
        .as_str()
        .ok_or_else(|| Failure::invalid("Token counters must be decimal strings or null"))?;
    if text.is_empty()
        || !text.bytes().all(|c| c.is_ascii_digit())
        || (text.len() > 1 && text.starts_with('0'))
    {
        return Err(Failure::invalid(
            "Token counters must be canonical nonnegative decimal integers",
        ));
    }
    text.parse::<i64>()
        .map(Some)
        .map_err(|_| Failure::invalid("Token counter exceeds signed 64-bit range"))
}

pub fn validate_observation(v: &Value) -> Result<()> {
    if !v["totalTokens"].is_null() {
        validate_total(v)?;
    }

    if v["actor"]["kind"] == "agent" {
        value_id(&v["actor"]["id"])?;
    } else if !v["actor"]["id"].is_null() {
        return Err(Failure::invalid("Human usage actor must have null id"));
    }
    for name in [
        "source",
        "harness",
        "surface",
        "sessionId",
        "epoch",
        "evidenceId",
    ] {
        if v[name].as_str().is_none_or(|s| s.trim().is_empty()) {
            return Err(Failure::invalid(format!("{name} must not be blank")));
        }
    }
    for name in ["observedAt", "periodStart", "periodEnd"] {
        if let Some(s) = v[name].as_str() {
            DateTime::parse_from_rfc3339(s)
                .map_err(|_| Failure::invalid("Usage timestamps must be RFC3339"))?;
        }
    }
    if let (Some(a), Some(b)) = (v["periodStart"].as_str(), v["periodEnd"].as_str()) {
        if DateTime::parse_from_rfc3339(a).unwrap() > DateTime::parse_from_rfc3339(b).unwrap() {
            return Err(Failure::invalid("Usage period is reversed"));
        }
    }
    let counts = COMPONENTS
        .map(|key| counter(&v[key]))
        .into_iter()
        .collect::<Result<Vec<_>>>()?;
    for (subset, total) in [(2, 0), (3, 1)] {
        if let (Some(a), Some(b)) = (counts[subset], counts[total]) {
            if a > b {
                return Err(Failure::invalid(
                    "Cache and reasoning counters must be subsets of inclusive input/output",
                ));
            }
        }
    }
    if v["reportKind"] == "unavailable" {
        if counts.iter().any(Option::is_some)
            || v["quality"] != "unavailable"
            || v["discovery"]["reason"]
                .as_str()
                .is_none_or(|s| s.trim().is_empty())
            || v["discovery"]["attempts"].as_array().is_none_or(|items| {
                items.is_empty()
                    || items
                        .iter()
                        .any(|v| v.as_str().is_none_or(|s| s.trim().is_empty()))
            })
        {
            return Err(Failure::invalid(
                "An unavailable observation needs null counters and investigated reason/attempts",
            ));
        }
    } else if v["quality"] == "unavailable" || counts[0].is_none() && counts[1].is_none() {
        return Err(Failure::invalid(
            "Measured/estimated usage needs at least one known input/output component",
        ));
    }
    if v["reportKind"] == "period_delta"
        && (v["scope"] != "request" || !v["previousEvidenceId"].is_null())
    {
        return Err(Failure::invalid(
            "Period deltas require request scope, stable evidenceId and no predecessor",
        ));
    }
    if v["reportKind"] == "cumulative_snapshot" && v["scope"] == "request" {
        return Err(Failure::invalid(
            "Cumulative snapshots require session or session_tree scope",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn new_summary_requires_real_session_total_model_and_agent() {
        let entry = json!({"reportKind":"cumulative_snapshot","scope":"session","quality":"measured","actor":{"kind":"agent","id":"10000000-0000-7000-8000-000000000002"},"modelId":"observed-model","inputTokens":"100","outputTokens":"20","totalTokens":"120","previousEvidenceId":null});
        assert!(require_report(&json!({"usageReport":{"entries":[entry.clone()]}})).is_ok());
        for (field, value) in [
            ("totalTokens", Value::Null),
            ("totalTokens", json!(120)),
            ("totalTokens", json!("130")),
            ("inputTokens", Value::Null),
            ("outputTokens", Value::Null),
            ("modelId", Value::Null),
            ("modelId", json!("  ")),
            ("quality", json!("estimated")),
            ("reportKind", json!("unavailable")),
            ("reportKind", json!("period_delta")),
            ("scope", json!("request")),
            ("actor", json!({"kind":"human","id":null})),
        ] {
            let mut invalid = entry.clone();
            invalid[field] = value;
            assert!(
                require_report(&json!({"usageReport":{"entries":[invalid]}})).is_err(),
                "accepted invalid {field}"
            );
        }
        let mut wide = entry.clone();
        wide["inputTokens"] = json!("9007199254740993");
        wide["outputTokens"] = json!("0");
        wide["totalTokens"] = json!("9007199254740993");
        assert!(require_report(&json!({"usageReport":{"entries":[wide.clone()]}})).is_ok());
        wide["inputTokens"] = json!(i64::MAX.to_string());
        wide["outputTokens"] = json!("1");
        wide["totalTokens"] = json!("9223372036854775808");
        assert!(require_report(&json!({"usageReport":{"entries":[wide]}})).is_err());
    }
    #[test]
    fn token_strings_preserve_large_integers_and_missing_values() {
        assert_eq!(
            counter(&json!("9007199254740993")).unwrap(),
            Some(9007199254740993)
        );
        assert_eq!(counter(&Value::Null).unwrap(), None);
        assert_eq!(counter(&json!("0")).unwrap(), Some(0));
        for value in [
            json!(0),
            json!("01"),
            json!("-1"),
            json!("1.5"),
            json!("9223372036854775808"),
        ] {
            assert!(counter(&value).is_err());
        }
    }
}
