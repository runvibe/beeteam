//! Explicit execution lifecycle; transport-independent and inside summary UnitOfWork.
mod counters;
mod reconciliation;
use super::*;
use counters::{key, time};
pub(super) use reconciliation::reconcile;
use std::collections::{BTreeMap, BTreeSet};

fn conflict(message: &str, interval: &Record) -> Failure {
    let mut e = Failure::new("usage_attribution_conflict", message);
    e.details = json!({"taskId":interval.data["taskId"],"executionId":interval.data["executionId"],"intervalId":interval.id});
    e
}
fn selected(summary: &Record, input: &Value) -> Result<Vec<Value>> {
    let ids = input["evidenceIds"]
        .as_array()
        .ok_or_else(|| Failure::invalid("evidenceIds is required"))?;
    let mut found = Vec::new();
    let mut unique = BTreeSet::new();
    for id in ids {
        if !unique.insert(id.as_str().unwrap_or("")) {
            return Err(Failure::invalid("Duplicate boundary evidenceId"));
        }
        let matches = summary.data["usageReport"]["entries"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|e| e["observation"]["evidenceId"] == *id)
            .collect::<Vec<_>>();
        if matches.len() != 1 {
            return Err(Failure::invalid(
                "Boundary evidenceId must select exactly one supplied usage entry",
            ));
        }
        let entry = matches[0];
        if entry["observation"]["attribution"] != "unallocated" {
            return Err(Failure::invalid(
                "Tracked boundaries require unallocated usage; interval attribution is separate",
            ));
        }
        found.push(entry.clone());
    }
    Ok(found)
}
fn identity(v: &Value) -> Value {
    json!([
        v["source"],
        v["harness"],
        v["surface"],
        v["sessionId"],
        v["scope"],
        v["actor"]
    ])
}
fn validate_entries(entries: &[Value], execution: &Value) -> Result<()> {
    if entries.is_empty() {
        return Err(Failure::invalid("A boundary needs measured evidence"));
    }
    let first = &entries[0]["observation"];
    let mut keys = BTreeSet::new();
    let mode = execution["counterMode"].as_str().unwrap();
    if mode == "global" && entries.len() != 1 {
        return Err(Failure::invalid(
            "Global mode selects exactly one inclusive counter; never mix totals and parts",
        ));
    }
    for entry in entries {
        let obs = &entry["observation"];
        if identity(obs) != execution["identity"]
            || time(&obs["observedAt"])? != time(&first["observedAt"])?
        {
            return Err(Failure::invalid("Boundary evidence must match execution agent/session/scope and one observed timestamp"));
        }
        if !keys.insert(key(obs, mode)) {
            return Err(Failure::invalid("Duplicate counter series at boundary"));
        }
    }
    Ok(())
}
fn shares(a: &Value, b: &Value) -> bool {
    a["source"] == b["source"]
        && (a["sessionId"] == b["sessionId"]
            || a["coverageRootSessionId"] == b["coverageRootSessionId"])
}
fn check_range(records: &Records, data: &Value, id: Option<Uuid>, end: &Value) -> Result<()> {
    let start = time(&data["startObservedAt"])?;
    let end = if end.is_null() {
        None
    } else {
        Some(time(end)?)
    };
    if end.is_some_and(|end| end < start) {
        return Err(Failure::invalid("End precedes interval start"));
    }
    for other in records.list("task_execution_intervals") {
        if Some(other.id) == id || !shares(data, &other.data) {
            continue;
        }
        // Invalidated measurements still reserve their declared work range.
        let os = time(&other.data["startObservedAt"])?;
        let oe = if other.data["endObservedAt"].is_null() {
            None
        } else {
            Some(time(&other.data["endObservedAt"])?)
        };
        if end.is_none_or(|e| os < e) && oe.is_none_or(|e| start < e) {
            return Err(conflict(
                "Consumption source has an overlapping declared interval",
                other,
            ));
        }
    }
    Ok(())
}
fn models(entries: &[Value]) -> Value {
    json!(entries
        .iter()
        .map(|e| e["observation"]["modelId"].as_str().unwrap().to_owned())
        .collect::<BTreeSet<_>>())
}
fn refresh(interval: &mut Record, closed: bool) -> Result<()> {
    let series = interval.data["counters"].as_array().unwrap();
    let total = counters::sum(series)?;
    let incomplete =
        series.iter().any(|s| s["incomplete"] == true) || interval.data["coverageLost"] == true;
    let valid = closed && !incomplete && total.is_some();
    interval.data["totalTokens"] = if valid {
        json!(total.unwrap().to_string())
    } else {
        Value::Null
    };
    interval.data["partialTokens"] = if !valid {
        total.map(|n| json!(n.to_string())).unwrap_or(Value::Null)
    } else {
        Value::Null
    };
    interval.data["coverage"] = json!(if valid {
        "complete"
    } else if incomplete {
        "incomplete"
    } else {
        "open"
    });
    interval.data["state"] = json!(if closed {
        if valid {
            "closed"
        } else {
            "incomplete"
        }
    } else {
        "open"
    });
    interval.data["observedDurationMs"] = if closed {
        json!(
            (time(&interval.data["endObservedAt"])? - time(&interval.data["startObservedAt"])?)
                .num_milliseconds()
                .to_string()
        )
    } else {
        Value::Null
    };
    Ok(())
}
fn save_counters(records: &mut Records, interval: &Record) {
    let keys = interval.data["counters"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s["counterKey"].clone())
        .collect::<Vec<_>>();
    for r in records.rows.values_mut().filter(|r| {
        r.table == "task_execution_interval_counters"
            && r.reference("intervalId") == Some(interval.id)
    }) {
        if !keys.contains(&r.data["counterKey"]) && r.deleted_at.is_none() {
            r.deleted_at = Some(Utc::now());
            r.touch();
        }
    }
    for series in interval.data["counters"].as_array().unwrap() {
        let existing = records
            .rows
            .values()
            .find(|r| {
                r.table == "task_execution_interval_counters"
                    && r.reference("intervalId") == Some(interval.id)
                    && r.data["counterKey"] == series["counterKey"]
            })
            .cloned();
        let mut r =
            existing.unwrap_or_else(|| Record::new("task_execution_interval_counters", json!({})));
        r.data = json!({"taskId":interval.data["taskId"],"intervalId":interval.id,"counterKey":series["counterKey"],"calculation":series,"revision":interval.data["revision"]});
        r.deleted_at = None;
        r.touch();
        records.insert(r);
    }
}
fn audit(records: &mut Records, interval: &Record, reason: &str, actor: &Actor) {
    records.insert(Record::new("task_execution_interval_revisions",json!({"taskId":interval.data["taskId"],"intervalId":interval.id,"revision":interval.data["revision"],"reason":reason,"reportingActor":actor.value(),"interval":interval.value()})));
}

pub(super) fn apply(records: &mut Records, summary: &mut Record, c: &Command) -> Result<()> {
    let Some(input) = c.body.get("executionTracking") else {
        return Ok(());
    };
    let action = input["action"].as_str().unwrap();
    let task = c.id("taskId")?;
    let entries = selected(summary, input)?;
    let opening = action == "start" || action == "resume";
    let closing = action == "pause" || action == "finish";
    let mut execution = if action == "start" {
        if !input["executionId"].is_null() || !input["intervalId"].is_null() {
            return Err(Failure::invalid("Start IDs are server-generated"));
        }
        let first = entries
            .first()
            .ok_or_else(|| Failure::invalid("Start requires evidence"))?;
        let o = &first["observation"];
        let mode = input["counterMode"]
            .as_str()
            .ok_or_else(|| Failure::invalid("Start requires counterMode"))?;
        let root = input["coverageRootSessionId"]
            .as_str()
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Failure::invalid("Start requires actual coverageRootSessionId"))?;
        Record::new(
            "task_executions",
            json!({"taskId":task,"agentId":o["actor"]["id"],"source":o["source"],"sessionId":o["sessionId"],"coverageRootSessionId":root,"scope":o["scope"],"identity":identity(o),"counterMode":mode,"state":"active","startSummaryId":summary.id,"endSummaryId":null,"activeIntervalId":null}),
        )
    } else {
        let e = records
            .get("task_executions", body_id(input, "executionId")?)?
            .clone();
        if e.reference("taskId") != Some(task) {
            return Err(Failure::missing());
        }
        if input.get("counterMode").is_some() || input.get("coverageRootSessionId").is_some() {
            return Err(Failure::invalid(
                "Execution counter mode and coverage root are immutable",
            ));
        }
        e
    };
    if execution.data["state"] == "finished" {
        return Err(Failure::invalid(
            "Execution already finished; use the original idempotency key for retries",
        ));
    }
    let paused_finish = action == "finish" && execution.data["state"] == "paused";
    if input["coverageLost"] == true && (opening || paused_finish) {
        return Err(Failure::invalid(
            "coverageLost requires checkpoint, pause or active finish with a fresh boundary",
        ));
    }
    if paused_finish {
        if !entries.is_empty() || !input["intervalId"].is_null() {
            return Err(Failure::invalid(
                "Paused finish has no interval or evidence boundary",
            ));
        }
    } else {
        validate_entries(&entries, &execution.data)?;
    }
    let mut interval: Option<Record> = None;
    if opening {
        if action == "resume" && execution.data["state"] != "paused" {
            return Err(Failure::invalid("Resume requires a paused execution"));
        }
        if !input["intervalId"].is_null() {
            return Err(Failure::invalid("Opening intervalId is server-generated"));
        }
        let obs = &entries[0]["observation"];
        let mode = execution.data["counterMode"].as_str().unwrap();
        let series=entries.iter().map(|e|json!({"counterKey":key(&e["observation"],mode),"incomplete":false,"segments":[counters::initial(e,json!(summary.id))]})).collect::<Vec<_>>();
        let mut r = Record::new(
            "task_execution_intervals",
            json!({"taskId":task,"executionId":execution.id,"agentId":execution.data["agentId"],"source":execution.data["source"],"sessionId":execution.data["sessionId"],"coverageRootSessionId":execution.data["coverageRootSessionId"],"scope":execution.data["scope"],"counterMode":mode,"state":"open","startSummaryId":summary.id,"endSummaryId":null,"startObservedAt":time(&obs["observedAt"])?.with_timezone(&Utc).to_rfc3339_opts(chrono::SecondsFormat::Nanos,true),"endObservedAt":null,"latestObservedAt":obs["observedAt"],"startReceivedAt":summary.created_at,"endReceivedAt":null,"counters":series,"models":models(&entries),"revision":1,"reason":input["reason"],"coverageLost":false}),
        );
        // Same source/session always keeps its root declaration, even after closure.
        for old in records.list("task_executions") {
            if old.data["source"] == r.data["source"]
                && old.data["sessionId"] == r.data["sessionId"]
                && old.data["coverageRootSessionId"] != r.data["coverageRootSessionId"]
            {
                return Err(Failure::invalid(
                    "Session coverage root cannot be changed to evade exclusivity",
                ));
            }
        }
        check_range(records, &r.data, None, &Value::Null)?;
        refresh(&mut r, false)?;
        execution.data["activeIntervalId"] = json!(r.id);
        execution.data["state"] = json!("active");
        interval = Some(r);
    } else if !paused_finish {
        if execution.data["state"] != "active" {
            return Err(Failure::invalid("Boundary requires an active execution"));
        }
        let iid = body_id(input, "intervalId")?;
        if execution.data["activeIntervalId"] != json!(iid) {
            return Err(Failure::invalid(
                "intervalId does not identify the execution's open interval",
            ));
        }
        let mut r = records.get("task_execution_intervals", iid)?.clone();
        let observed = &entries[0]["observation"]["observedAt"];
        if time(observed)? < time(&r.data["latestObservedAt"])? {
            return Err(Failure::invalid("Boundary predates checkpoint"));
        }
        audit(records, &r, action, c.actor()?);
        let mode = execution.data["counterMode"].as_str().unwrap();
        let incoming = entries
            .iter()
            .map(|e| (key(&e["observation"], mode), e))
            .collect::<BTreeMap<_, _>>();
        let series = r.data["counters"].as_array_mut().unwrap();
        let gap = input["coverageLost"] == true;
        if gap && input["reason"].as_str().is_none_or(|s| s.trim().is_empty()) {
            return Err(Failure::invalid("Lost coverage requires a factual reason"));
        }
        for s in series.iter_mut() {
            if let Some(entry) = incoming.get(s["counterKey"].as_str().unwrap()) {
                let missing = s["missingBoundary"] == true;
                counters::advance(s, entry, json!(summary.id), mode, gap || missing)?;
                s.as_object_mut().unwrap().remove("missingBoundary");
            } else {
                s["incomplete"] = json!(true);
                s["missingBoundary"] = json!(true);
            }
        }
        for (k, e) in incoming {
            if !series.iter().any(|s| s["counterKey"] == k) {
                series.push(json!({"counterKey":k,"incomplete":true,"segments":[counters::initial(e,json!(summary.id))]}));
            }
        }
        let mut ms = r.data["models"]
            .as_array()
            .unwrap()
            .iter()
            .cloned()
            .collect::<Vec<_>>();
        for model in models(&entries).as_array().unwrap() {
            if !ms.contains(model) {
                ms.push(model.clone());
            }
        }
        r.data["models"] = json!(ms);
        r.data["latestObservedAt"] = observed.clone();
        r.data["revision"] = json!(r.data["revision"].as_i64().unwrap() + 1);
        if gap {
            r.data["coverageLost"] = json!(true);
        }
        r.data["reason"] = input["reason"].clone();
        if closing {
            r.data["endObservedAt"] = json!(time(observed)?
                .with_timezone(&Utc)
                .to_rfc3339_opts(chrono::SecondsFormat::Nanos, true));
            r.data["endReceivedAt"] = json!(summary.created_at);
            r.data["endSummaryId"] = json!(summary.id);
        }
        check_range(
            records,
            &r.data,
            Some(iid),
            if closing { observed } else { &Value::Null },
        )?;
        refresh(&mut r, closing)?;
        r.touch();
        interval = Some(r);
    }
    if closing {
        execution.data["state"] = json!(if action == "pause" {
            "paused"
        } else {
            "finished"
        });
        execution.data["activeIntervalId"] = Value::Null;
    }
    if action == "finish" {
        execution.data["endSummaryId"] = json!(summary.id);
    }
    execution.touch();
    let result = json!({"action":action,"executionId":execution.id,"intervalId":interval.as_ref().map(|r|r.id),"executionState":execution.data["state"],"intervalState":interval.as_ref().map(|r|r.data["state"].clone())});
    if let Some(r) = interval {
        save_counters(records, &r);
        records.insert(r);
    }
    records.insert(execution.clone());
    records.insert(Record::new("task_execution_tracking_events",json!({"taskId":task,"executionId":execution.id,"intervalId":result["intervalId"],"action":action,"summaryId":summary.id,"statusObserved":summary.data["statusObserved"],"reportingActor":c.actor()?.value(),"observedAt":entries.first().map(|e|e["observation"]["observedAt"].clone()),"receivedAt":summary.created_at,"source":execution.data["source"],"sessionId":execution.data["sessionId"],"agentId":execution.data["agentId"],"models":models(&entries),"evidence":entries,"reason":input["reason"]})));
    summary.data["executionTracking"] = result;
    validate_task_total(records, task)?;
    Ok(())
}
fn validate_task_total(records: &Records, task: Uuid) -> Result<()> {
    let mut total = 0i64;
    for r in records
        .list("task_execution_intervals")
        .into_iter()
        .filter(|r| r.reference("taskId") == Some(task))
    {
        for field in ["totalTokens", "partialTokens"] {
            if let Some(n) = crate::dto::usage::counter(&r.data[field])? {
                total = total
                    .checked_add(n)
                    .ok_or_else(|| Failure::invalid("Task interval aggregate overflow"))?;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn removed_counter_series_are_tombstoned_and_reintroduced_with_same_id() {
        let mut records = Records::default();
        let mut interval = Record::new(
            "task_execution_intervals",
            json!({"taskId":Uuid::now_v7(),"revision":1,"counters":[{"counterKey":"A","segments":[]},{"counterKey":"B","segments":[]}]}),
        );
        save_counters(&mut records, &interval);
        let b = records
            .list("task_execution_interval_counters")
            .into_iter()
            .find(|r| r.data["counterKey"] == "B")
            .unwrap()
            .id;
        interval.data["counters"].as_array_mut().unwrap().pop();
        save_counters(&mut records, &interval);
        assert_eq!(records.list("task_execution_interval_counters").len(), 1);
        assert!(records.rows[&("task_execution_interval_counters", b)]
            .deleted_at
            .is_some());
        interval.data["counters"]
            .as_array_mut()
            .unwrap()
            .push(json!({"counterKey":"B","segments":[]}));
        save_counters(&mut records, &interval);
        assert_eq!(records.list("task_execution_interval_counters").len(), 2);
        assert!(records.get("task_execution_interval_counters", b).is_ok());
    }
}
