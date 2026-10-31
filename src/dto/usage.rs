//! Transport-independent validation for optional, evidence-backed summary usage.
use super::backend::{value_id, Failure, Result};
use chrono::DateTime;
use serde_json::Value;

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
            || v["discovery"]["attempts"]
                .as_array()
                .is_none_or(Vec::is_empty)
        {
            return Err(Failure::invalid("An optional unavailable observation needs null counters and investigated reason/attempts"));
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
