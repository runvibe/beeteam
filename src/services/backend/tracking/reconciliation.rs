//! Explicit, versioned corrections; source observations and previous results remain immutable.
use super::*;
fn boundary(records: &Records, task: Uuid, refs: &Value) -> Result<Vec<Value>> {
    let mut entries = Vec::new();
    for reference in refs
        .as_array()
        .ok_or_else(|| Failure::invalid("Boundary references required"))?
    {
        let summary = records.get("execution_summaries", body_id(reference, "summaryId")?)?;
        if summary.reference("taskId") != Some(task) {
            return Err(Failure::missing());
        }
        let entry = summary.data["usageReport"]["entries"]
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["observation"]["evidenceId"] == reference["evidenceId"])
            .ok_or_else(Failure::missing)?;
        crate::dto::usage::require_report(
            &json!({"usageReport":{"entries":[entry["observation"]]}}),
        )?;
        if entry["observation"]["attribution"] != "unallocated" {
            return Err(Failure::invalid(
                "Reconciled boundaries must be unallocated session evidence",
            ));
        }
        if entries.iter().any(|old: &Value| {
            old["observation"]["evidenceId"] == entry["observation"]["evidenceId"]
        }) {
            return Err(Failure::invalid(
                "Boundary evidence references must use distinct evidenceIds",
            ));
        }
        entries.push(entry.clone());
    }
    Ok(entries)
}
fn referenced_summary(refs: &Value, entry: &Value) -> Result<Uuid> {
    let reference = refs
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["evidenceId"] == entry["observation"]["evidenceId"])
        .ok_or_else(Failure::missing)?;
    body_id(reference, "summaryId")
}
pub(in super::super) async fn reconcile(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let id = c.id("intervalId")?;
    let task = c.id("taskId")?;
    let mut r = unit.records.get("task_execution_intervals", id)?.clone();
    if r.reference("taskId") != Some(task) {
        return Err(Failure::missing());
    }
    check_version(&r, c.expected_version)?;
    if r.data["state"] == "open" {
        return Err(Failure::invalid("Close with a verified boundary and coverageLost before reconciliation; never invent automatic end"));
    }
    let reason = c.body["reason"]
        .as_str()
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| Failure::invalid("Reconciliation requires reason"))?;
    audit(&mut unit.records, &r, reason, c.actor()?);
    if c.body["invalidate"] == true {
        if c.body.get("startEvidence").is_some() || c.body.get("endEvidence").is_some() {return Err(Failure::invalid("Invalidation does not replace evidence boundaries"));}
        r.data["state"] = json!("invalid");
        r.data["coverage"] = json!("invalid");
        r.data["totalTokens"] = Value::Null;
        r.data["partialTokens"] = Value::Null;
    } else {
        let start = boundary(&unit.records, task, &c.body["startEvidence"])?;
        let end = boundary(&unit.records, task, &c.body["endEvidence"])?;
        let execution = unit
            .records
            .get("task_executions", body_id(&r.data, "executionId")?)?;
        validate_entries(&start, &execution.data)?;
        validate_entries(&end, &execution.data)?;
        let mode = execution.data["counterMode"].as_str().unwrap();
        let end_by_key = end
            .iter()
            .map(|e| (key(&e["observation"], mode), e))
            .collect::<BTreeMap<_, _>>();
        let mut series = Vec::new();
        for entry in &start {
            let k = key(&entry["observation"], mode);
            let mut s = json!({"counterKey":k,"incomplete":false,"segments":[counters::initial(entry,json!(referenced_summary(&c.body["startEvidence"],entry)?))]});
            if let Some(last) = end_by_key.get(&k) {
                counters::advance(
                    &mut s,
                    last,
                    json!(referenced_summary(&c.body["endEvidence"], last)?),
                    mode,
                    false,
                )?;
            } else {
                s["incomplete"] = json!(true);
            }
            series.push(s);
        }
        if end.len() != start.len() {
            return Err(Failure::invalid(
                "Correction must explicitly pair the same counter series",
            ));
        }
        r.data["counters"] = json!(series);
        r.data["coverageLost"] = json!(false);
        r.data["startObservedAt"] = json!(time(&start[0]["observation"]["observedAt"])?
            .with_timezone(&Utc)
            .to_rfc3339_opts(chrono::SecondsFormat::Nanos, true));
        r.data["endObservedAt"] = json!(time(&end[0]["observation"]["observedAt"])?
            .with_timezone(&Utc)
            .to_rfc3339_opts(chrono::SecondsFormat::Nanos, true));
        r.data["latestObservedAt"] = r.data["endObservedAt"].clone();
        r.data["startSummaryId"] = c.body["startEvidence"][0]["summaryId"].clone();
        r.data["endSummaryId"] = c.body["endEvidence"][0]["summaryId"].clone();
        let start_sid = referenced_summary(&c.body["startEvidence"], &start[0])?;
        let end_sid = referenced_summary(&c.body["endEvidence"], &end[0])?;
        r.data["startReceivedAt"] = json!(
            unit.records
                .get("execution_summaries", start_sid)?
                .created_at
        );
        r.data["endReceivedAt"] =
            json!(unit.records.get("execution_summaries", end_sid)?.created_at);
        let mut all = start;
        all.extend(end);
        r.data["models"] = models(&all);
        check_range(&unit.records, &r.data, Some(id), &r.data["endObservedAt"])?;
        refresh(&mut r, true)?;
    }
    r.data["reason"] = json!(reason);
    r.data["revision"] = json!(r.data["revision"].as_i64().unwrap() + 1);
    r.touch();
    save_counters(&mut unit.records, &r);
    unit.records.insert(r.clone());
    validate_task_total(&unit.records, task)?;
    let mut result = Outcome::data(r.value());
    result.version = Some(r.version);
    Ok(result)
}
