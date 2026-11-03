//! Comparable counter segments. A checkpoint replaces the current segment delta, never adds it twice.
use crate::dto::{
    backend::{Failure, Result},
    usage::{counter, COMPONENTS},
};
use chrono::{DateTime, FixedOffset};
use serde_json::{json, Value};

pub(super) fn time(v: &Value) -> Result<DateTime<FixedOffset>> {
    DateTime::parse_from_rfc3339(v.as_str().unwrap_or(""))
        .map_err(|_| Failure::invalid("Invalid observed boundary time"))
}
pub(super) fn key(v: &Value, mode: &str) -> String {
    if mode == "global" {
        "global".into()
    } else {
        json!([v["provider"], v["modelId"]]).to_string()
    }
}
fn comparable(a: &Value, b: &Value, mode: &str) -> bool {
    [
        "source",
        "sessionId",
        "epoch",
        "scope",
        "harness",
        "surface",
        "harnessVersion",
        "provider",
    ]
    .iter()
    .all(|k| a[k] == b[k])
        && (mode == "global" || a["modelId"] == b["modelId"])
}
fn difference(a: &Value, b: &Value) -> Result<Option<Value>> {
    let mut delta = json!({});
    for field in COMPONENTS.into_iter().chain(["totalTokens"]) {
        delta[field] = match (counter(&a[field])?, counter(&b[field])?) {
            (Some(a), Some(b)) if b >= a => json!((b - a).to_string()),
            (Some(_), Some(_)) => return Ok(None),
            _ => Value::Null,
        };
    }
    for (part, whole) in [
        ("cachedInputTokens", "inputTokens"),
        ("reasoningOutputTokens", "outputTokens"),
    ] {
        if let (Some(a), Some(b)) = (counter(&delta[part])?, counter(&delta[whole])?) {
            if a > b {
                return Ok(None);
            }
        }
    }
    Ok(Some(delta))
}
pub(super) fn initial(entry: &Value, summary: Value) -> Value {
    json!({"start":entry,"latest":entry,"startSummaryId":summary,"latestSummaryId":summary,"delta":null,"complete":true,"reason":null})
}
pub(super) fn advance(
    series: &mut Value,
    entry: &Value,
    summary: Value,
    mode: &str,
    gap: bool,
) -> Result<()> {
    let segments = series["segments"].as_array_mut().unwrap();
    let segment = segments.last_mut().unwrap();
    let last = &segment["latest"];
    let a = &last["observation"];
    let b = &entry["observation"];
    if time(&b["observedAt"])? < time(&a["observedAt"])? {
        return Err(Failure::invalid("Boundary predates the latest checkpoint"));
    }
    if last["evidenceKey"] == entry["evidenceKey"] {
        if gap {
            return Err(Failure::invalid(
                "Lost coverage requires a fresh boundary, not repeated evidence",
            ));
        }
        return Ok(());
    }
    if time(&b["observedAt"])? == time(&a["observedAt"])? {
        return Err(Failure::invalid(
            "Distinct boundary evidence must advance observed time",
        ));
    }
    let delta = difference(&segment["start"]["observation"], b)?;
    if gap || !comparable(a, b, mode) || difference(a, b)?.is_none() || delta.is_none() {
        segment["complete"] = json!(false);
        segment["reason"] = json!(if gap {
            "declared_gap"
        } else {
            "counter_reset_or_incompatible_epoch"
        });
        segments.push(initial(entry, summary));
        series["incomplete"] = json!(true);
    } else {
        segment["latest"] = entry.clone();
        segment["latestSummaryId"] = summary;
        segment["delta"] = delta.unwrap();
    }
    Ok(())
}
pub(super) fn sum(series: &[Value]) -> Result<Option<i64>> {
    let mut total: Option<i64> = None;
    for c in series {
        for s in c["segments"].as_array().unwrap() {
            if let Some(n) = counter(&s["delta"]["totalTokens"])? {
                total = Some(
                    total
                        .unwrap_or(0)
                        .checked_add(n)
                        .ok_or_else(|| Failure::invalid("Interval token aggregate overflow"))?,
                );
            }
        }
    }
    Ok(total)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn e(n: i64, t: i64, epoch: &str) -> Value {
        json!({"evidenceKey":format!("{epoch}-{t}"),"observation":{"source":"s","sessionId":"s","epoch":epoch,"scope":"session","modelId":"m","observedAt":format!("2026-11-03T00:00:{t:02}Z"),"inputTokens":n.to_string(),"outputTokens":"0","totalTokens":n.to_string()}})
    }
    #[test]
    fn checkpoints_replace_delta_and_reset_preserves_partial() {
        let mut s = json!({"segments":[initial(&e(1000,0,"a"),json!("s"))],"incomplete":false});
        advance(&mut s, &e(1300, 1, "a"), json!("c"), "global", false).unwrap();
        advance(&mut s, &e(1600, 2, "a"), json!("f"), "global", false).unwrap();
        assert_eq!(sum(&[s.clone()]).unwrap(), Some(600));
        advance(&mut s, &e(10, 3, "b"), json!("reset"), "global", false).unwrap();
        advance(&mut s, &e(60, 4, "b"), json!("f"), "global", false).unwrap();
        assert_eq!(sum(&[s.clone()]).unwrap(), Some(650));
        assert_eq!(s["incomplete"], true);
    }
    #[test]
    fn initial_is_not_zero_global_model_change_and_real_zero() {
        let mut s = json!({"segments":[initial(&e(1000,0,"a"),json!("s"))],"incomplete":false});
        assert_eq!(sum(&[s.clone()]).unwrap(), None);
        let mut end = e(1000, 1, "a");
        end["observation"]["modelId"] = json!("other");
        advance(&mut s, &end, json!("f"), "global", false).unwrap();
        assert_eq!(sum(&[s.clone()]).unwrap(), Some(0));
        assert_eq!(s["incomplete"], false);
    }
}
