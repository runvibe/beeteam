//! Summary checkpoint policy. Evidence lives in existing append-only summary JSON;
//! repositories own its SQL projection, snapshots and indexes.
use super::*;
use crate::dto::usage::{counter, validate_observation, COMPONENTS};

fn scope(v: &Value) -> Value {
    json!([
        v["source"],
        v["harness"],
        v["surface"],
        v["harnessVersion"],
        v["sessionId"],
        v["epoch"],
        v["actor"],
        v["scope"],
        v["provider"],
        v["modelId"]
    ])
}
fn key(v: &Value) -> String {
    Sha256::digest(
        serde_json::to_vec(&json!([
            v["source"],
            v["sessionId"],
            v["epoch"],
            v["evidenceId"]
        ]))
        .unwrap(),
    )
    .iter()
    .map(|byte| format!("{byte:02x}"))
    .collect()
}
fn all_entries(records: &Records) -> Vec<(Uuid, Uuid, Value)> {
    records
        .list("execution_summaries")
        .into_iter()
        .flat_map(|r| {
            r.data["usageReport"]["entries"]
                .as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(move |e| (r.id, r.reference("taskId").unwrap(), e))
        })
        .collect()
}
fn delta(current: &Value, previous: Option<&Value>) -> Result<Value> {
    let mut result = json!({});
    for field in COMPONENTS {
        let now = counter(&current[field])?;
        let value = if let Some(previous) = previous {
            match (now,counter(&previous[field])?) {
                (Some(a),Some(b))=>Some(a.checked_sub(b).filter(|n|*n>=0).ok_or_else(||Failure::invalid("Counter regressed; use a new epoch/baseline, never clamp a negative delta"))?),
                _=>None,
            }
        } else {
            now
        };
        result[field] = value.map(|n| json!(n.to_string())).unwrap_or(Value::Null);
    }
    for (subset, total) in [
        ("cachedInputTokens", "inputTokens"),
        ("reasoningOutputTokens", "outputTokens"),
    ] {
        if let (Some(a), Some(b)) = (counter(&result[subset])?, counter(&result[total])?) {
            if a > b {
                return Err(Failure::invalid("Delta subset exceeds its inclusive total"));
            }
        }
    }
    result["totalTokens"] = match (
        counter(&result["inputTokens"])?,
        counter(&result["outputTokens"])?,
    ) {
        (Some(a), Some(b)) => json!(a
            .checked_add(b)
            .ok_or_else(|| Failure::invalid("Token total overflow"))?
            .to_string()),
        _ => Value::Null,
    };
    Ok(result)
}

pub(super) fn report(
    records: &Records,
    task: Uuid,
    summary: Uuid,
    actor: &Actor,
    status: Value,
    input: &Value,
    existing: Option<Value>,
    tracked: bool,
) -> Result<Value> {
    let mut report=existing.unwrap_or_else(|| json!({"reportedAt":Utc::now(),"statusObserved":status,"reportingActor":actor.value(),"revision":0,"entries":[]}));
    let mut known = all_entries(records);
    let incoming = input["entries"]
        .as_array()
        .ok_or_else(|| Failure::invalid("usageReport.entries is required"))?;
    if report["entries"].as_array().unwrap().len() + incoming.len() > 256 {
        return Err(Failure::invalid(
            "A summary supports at most 256 usage entries including supplements",
        ));
    }
    let revision = report["revision"].as_i64().unwrap() + 1;
    for observation in incoming {
        validate_observation(observation)?;
        if observation["actor"]["kind"] == "agent" {
            records.get("agents", value_id(&observation["actor"]["id"])?)?;
        }
        let evidence = key(observation);
        let duplicate = known.iter().find(|(_, _, e)| e["evidenceKey"] == evidence);
        let mut derived = Value::Null;
        let mut canonical = summary;
        let mut counted = false;
        let mut reason = "baseline_or_unavailable";
        if let Some((sid, owner, entry)) = duplicate {
            if entry["observation"] != *observation {
                return Err(Failure::new(
                    "idempotency_conflict",
                    "Evidence identity was already recorded with different content",
                ));
            }
            if *owner != task && !(tracked && observation["attribution"] == "unallocated") {
                return Err(Failure::new(
                    "usage_attribution_conflict",
                    "Evidence already belongs to another task; cannot duplicate its allocation",
                ));
            }
            canonical = entry["canonicalSummaryId"]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .unwrap_or(*sid);
            reason = "duplicate_reference";
        } else if observation["reportKind"] == "period_delta" {
            derived = delta(observation, None)?;
        } else if observation["reportKind"] == "cumulative_snapshot" {
            let timestamp =
                chrono::DateTime::parse_from_rfc3339(observation["observedAt"].as_str().unwrap())
                    .unwrap();
            let latest = known
                .iter()
                .map(|(_, _, e)| &e["observation"])
                .filter(|old| {
                    old["reportKind"] == "cumulative_snapshot" && scope(old) == scope(observation)
                })
                .max_by_key(|old| {
                    chrono::DateTime::parse_from_rfc3339(old["observedAt"].as_str().unwrap())
                        .unwrap()
                });
            if let Some(latest) = latest {
                if timestamp
                    <= chrono::DateTime::parse_from_rfc3339(latest["observedAt"].as_str().unwrap())
                        .unwrap()
                    || (!observation["previousEvidenceId"].is_null()
                        && observation["previousEvidenceId"] != latest["evidenceId"])
                {
                    return Err(Failure::invalid("Cumulative observations must advance the latest checkpoint; older/disconnected intervals cannot be added"));
                }
            }
            if let Some(previous_id) = observation["previousEvidenceId"].as_str() {
                let mut previous = observation.clone();
                previous["evidenceId"] = json!(previous_id);
                let previous_key = key(&previous);
                let (_, owner, entry) = known
                    .iter()
                    .find(|(_, _, e)| e["evidenceKey"] == previous_key)
                    .ok_or_else(|| {
                        Failure::invalid(
                            "Previous evidence must already exist in the identical counter scope",
                        )
                    })?;
                if *owner != task && !(tracked && observation["attribution"] == "unallocated") {
                    return Err(Failure::invalid("Cannot attribute a cumulative interval crossing tasks; start a new baseline"));
                }
                let p = &entry["observation"];
                if scope(p) != scope(observation) {
                    return Err(Failure::invalid(
                        "Counter predecessor has a different actor/model/harness scope",
                    ));
                }
                if p["quality"] != observation["quality"]
                    || p["attribution"] != observation["attribution"]
                {
                    return Err(Failure::invalid("Counter predecessor has different quality or attribution; establish a comparable baseline"));
                }
                if p["reportKind"] != "cumulative_snapshot"
                    || chrono::DateTime::parse_from_rfc3339(p["observedAt"].as_str().unwrap())
                        .unwrap()
                        >= chrono::DateTime::parse_from_rfc3339(
                            observation["observedAt"].as_str().unwrap(),
                        )
                        .unwrap()
                {
                    return Err(Failure::invalid(
                        "Cumulative predecessor must be an earlier snapshot",
                    ));
                }
                if known.iter().any(|(_, _, e)| {
                    e["observation"]["previousEvidenceId"] == previous_id
                        && scope(&e["observation"]) == scope(observation)
                }) {
                    return Err(Failure::invalid("Counter predecessor already has a successor; overlapping cumulative deltas are not additive"));
                }
                derived = delta(observation, Some(p))?;
            }
        }
        if !derived.is_null() {
            counted =
                observation["attribution"] == "exact" && observation["scope"] != "session_tree";
            reason = if counted {
                "attributed"
            } else {
                "shared_or_unallocated"
            };
        }
        if counted {
            for field in COMPONENTS.into_iter().chain(["totalTokens"]) {
                let mut total = counter(&derived[field])?.unwrap_or(0) as i128;
                for (_, owner, old) in &known {
                    if *owner == task
                        && old["counted"] == true
                        && old["observation"]["quality"] == observation["quality"]
                    {
                        total += counter(&old["delta"][field])?.unwrap_or(0) as i128;
                    }
                }
                if total > i64::MAX as i128 {
                    return Err(Failure::invalid(
                        "Task token aggregate exceeds signed 64-bit range",
                    ));
                }
            }
        }
        // A single session scope cannot mix request and cumulative accounting, nor
        // per-model and aggregate counters. They could cover the same calls.
        if duplicate.is_none() && observation["reportKind"] != "unavailable" {
            for (_, _, e) in &known {
                let old = &e["observation"];
                if old["sessionId"] == observation["sessionId"]
                    && old["epoch"] == observation["epoch"]
                    && old["actor"] == observation["actor"]
                    && old["reportKind"] != "unavailable"
                {
                    if old["source"] != observation["source"]
                        || old["reportKind"] != observation["reportKind"]
                        || old["scope"] != observation["scope"]
                        || old["modelId"].is_null() != observation["modelId"].is_null()
                    {
                        return Err(Failure::invalid("Overlapping request/session or model/aggregate accounting modes require separate proven coverage"));
                    }
                }
            }
        }
        let entry = json!({"id":Uuid::now_v7(),"reportedAt":Utc::now(),"reportingActor":actor.value(),"reportRevision":revision,
            "observation":observation,"evidenceKey":evidence,"canonicalSummaryId":canonical,"delta":derived,"counted":counted,"coverageReason":reason});
        known.push((summary, task, entry.clone()));
        report["entries"].as_array_mut().unwrap().push(entry);
    }
    report["revision"] = json!(revision);
    if revision > 1 {
        report["reconciledAt"] = json!(Utc::now());
    }
    if serde_json::to_vec(&report).unwrap().len() > 65536 {
        return Err(Failure::invalid(
            "Stored summary usage, including supplements, must fit 65536 UTF-8 bytes",
        ));
    }
    Ok(report)
}

pub(super) async fn reconcile(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let task = c.id("taskId")?;
    let sid = c.id("summaryId")?;
    let record = unit.records.get("execution_summaries", sid)?.clone();
    if record.reference("taskId") != Some(task) {
        return Err(Failure::missing());
    }
    check_version(&record, c.expected_version)?;
    let status = record
        .data
        .get("statusObserved")
        .cloned()
        .unwrap_or_else(|| json!({"id":record.data["statusId"],"name":null,"isDone":null}));
    let existing = record
        .data
        .get("usageReport")
        .filter(|v| !v.is_null())
        .cloned();
    let updated = report(
        &unit.records,
        task,
        sid,
        c.actor()?,
        status,
        &c.body,
        existing,
        false,
    )?;
    let r = unit.records.get_mut("execution_summaries", sid)?;
    r.data["usageReport"] = updated;
    r.touch();
    // Task's current state and its historical narrative are deliberately untouched.
    Ok(Outcome {
        data: r.value(),
        version: Some(r.version),
        created_id: None,
        file: None,
    })
}
