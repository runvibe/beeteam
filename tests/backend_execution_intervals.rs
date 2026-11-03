#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;
async fn setup() -> (Router, Value, Value, Value, Value) {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Interval fixture"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Intervals","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Intervals","teamId":id(&team)}),
        None,
    )
    .await;
    let mut tasks = Vec::new();
    for title in ["A", "B"] {
        tasks.push(ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":title,"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await);
    }
    (app, agent, board, tasks.remove(0), tasks.remove(0))
}
fn payload(
    task: &Value,
    board: &Value,
    action: &str,
    n: i64,
    t: u32,
    tracking: Option<&Value>,
) -> Value {
    let mut usage = session_usage(task["executorAgentId"].as_str().unwrap());
    let e = &mut usage["entries"][0];
    e["source"] = json!("interval-fixture");
    e["sessionId"] = json!("shared");
    e["epoch"] = json!("epoch");
    e["evidenceId"] = json!(format!("e-{t}"));
    e["observedAt"] = json!(format!("2026-11-03T00:{:02}:{:02}Z", t / 60, t % 60));
    e["attribution"] = json!("unallocated");
    e["inputTokens"] = json!(n.to_string());
    e["outputTokens"] = json!("0");
    e["totalTokens"] = json!(n.to_string());
    e["cachedInputTokens"] = Value::Null;
    e["reasoningOutputTokens"] = Value::Null;
    let mut tr = json!({"action":action,"evidenceIds":[format!("e-{t}")]});
    if action == "start" {
        tr["counterMode"] = json!("global");
        tr["coverageRootSessionId"] = json!("shared");
    }
    if let Some(old) = tracking {
        tr["executionId"] = old["executionId"].clone();
        if action != "resume" {
            tr["intervalId"] = old["intervalId"].clone();
        }
    }
    json!({"usageReport":usage,"executionTracking":tr,"summary":action,"currentSummary":format!("Current {action}"),"statusId":task["statusId"],"outcome":"progress","deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(task),"originBoardId":id(board)}})
}
async fn step(app: &Router, task: &mut Value, body: Value) -> Value {
    let v = ok(
        app,
        "POST",
        &format!("/api/v1/tasks/{}/execution-summaries", id(task)),
        body,
        ver(task),
    )
    .await;
    *task = v["task"].clone();
    v["executionSummary"].clone()
}
async fn usage(app: &Router, task: &Value) -> Value {
    get(
        app,
        &format!("/api/v1/tasks/{}/execution-interval-usage", id(task)),
    )
    .await
}
async fn intervals(app: &Router, task: &Value) -> Value {
    get(
        app,
        &format!("/api/v1/tasks/{}/execution-intervals", id(task)),
    )
    .await
}
async fn tool(app: &Router, name: &str, args: Value) -> Value {
    let response=app.clone().oneshot(Request::post("/mcp").header("host","127.0.0.1").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").header("content-type","application/json").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice::<Value>(&response.into_body().collect().await.unwrap().to_bytes())
        .unwrap()["result"]
        .clone()
}
#[tokio::test]
async fn sequential_tasks_checkpoints_and_gap_are_not_double_counted() {
    let (app, _, board, mut a, mut b) = setup().await;
    let body = payload(&a, &board, "start", 1000, 0, None);
    let start = step(&app, &mut a, body).await;
    assert_eq!(usage(&app, &a).await["validTotalTokens"], Value::Null);
    let tr = &start["executionTracking"];
    let body = payload(&a, &board, "checkpoint", 1300, 1, Some(tr));
    step(&app, &mut a, body).await;
    let u = usage(&app, &a).await;
    assert_eq!(u["partialTotalTokens"], "300");
    assert_eq!(u["validTotalTokens"], Value::Null);
    let body = payload(&a, &board, "finish", 1600, 2, Some(tr));
    step(&app, &mut a, body).await;
    let body = payload(&b, &board, "start", 1650, 3, None);
    let start_b = step(&app, &mut b, body).await;
    let body = payload(
        &b,
        &board,
        "finish",
        2000,
        4,
        Some(&start_b["executionTracking"]),
    );
    step(&app, &mut b, body).await;
    assert_eq!(usage(&app, &a).await["validTotalTokens"], "600");
    assert_eq!(usage(&app, &a).await["partialTotalTokens"], Value::Null);
    assert_eq!(usage(&app, &b).await["validTotalTokens"], "350");
    assert_eq!(usage(&app, &a).await["observedDurationMs"], "2000");
    let timeline = get(
        &app,
        &format!("/api/v1/tasks/{}/execution-tracking-events?limit=1", id(&a)),
    )
    .await;
    assert_eq!(timeline["total"], 3);
    assert_eq!(timeline["items"][0]["summaryId"], start["id"]);
    assert_eq!(get(&app, "/api/v1/execution-intervals").await["total"], 0);
}
#[tokio::test]
async fn pause_resume_excludes_other_task_and_paused_finish_has_no_boundary() {
    let (app, _, board, mut a, mut b) = setup().await;
    let body = payload(&a, &board, "start", 1000, 0, None);
    let s = step(&app, &mut a, body).await;
    let body = payload(&a, &board, "pause", 1300, 1, Some(&s["executionTracking"]));
    step(&app, &mut a, body).await;
    let body = payload(&b, &board, "start", 1400, 2, None);
    let bs = step(&app, &mut b, body).await;
    let body = payload(
        &b,
        &board,
        "finish",
        1900,
        3,
        Some(&bs["executionTracking"]),
    );
    step(&app, &mut b, body).await;
    let body = payload(&a, &board, "resume", 2000, 4, Some(&s["executionTracking"]));
    let r = step(&app, &mut a, body).await;
    let body = payload(&a, &board, "pause", 2200, 5, Some(&r["executionTracking"]));
    step(&app, &mut a, body).await;
    let mut body = payload(&a, &board, "finish", 2300, 6, Some(&r["executionTracking"]));
    body["executionTracking"]["evidenceIds"] = json!([]);
    body["executionTracking"]
        .as_object_mut()
        .unwrap()
        .remove("intervalId");
    let f = step(&app, &mut a, body).await;
    assert_eq!(f["executionTracking"]["intervalId"], Value::Null);
    assert_eq!(usage(&app, &a).await["validTotalTokens"], "500");
    assert_eq!(intervals(&app, &a).await["total"], 2);
}
#[tokio::test]
async fn overlapping_agents_and_atomic_compound_rejection() {
    let (app, _, board, mut a, b) = setup().await;
    let body = payload(&a, &board, "start", 1000, 0, None);
    let s = step(&app, &mut a, body).await;
    let other = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Other"}),
        None,
    )
    .await;
    let mut body = payload(&b, &board, "start", 1100, 1, None);
    body["usageReport"]["entries"][0]["actor"]["id"] = json!(id(&other));
    let before_task=get(&app,&format!("/api/v1/tasks/{}",id(&b))).await;
    let before = get(&app, &format!("/api/v1/tasks/{}/comments", id(&b))).await;
    let result=tool(&app,"close_activity",json!({"taskId":id(&b),"expectedVersion":b["version"],"idempotencyKey":uuid::Uuid::new_v4(),"actor":{"kind":"human"},"comment":"Must roll back","execution":body})).await;
    assert_eq!(result["isError"], true, "{result}");
    assert!(result.to_string().contains("usage_attribution_conflict"));
    assert_eq!(get(&app, &format!("/api/v1/tasks/{}", id(&b))).await, before_task);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(&b))).await,
        before
    );
    let recovered = get(&app, "/api/v1/execution-intervals?sessionId=shared").await;
    assert_eq!(recovered["total"], 1);
    assert_eq!(
        recovered["items"][0]["id"],
        s["executionTracking"]["intervalId"]
    );
}
#[tokio::test]
async fn resets_models_revisions_and_historical_replay() {
    let (app, _, board, mut a, _) = setup().await;
    let body = payload(&a, &board, "start", 1000, 0, None);
    let s = step(&app, &mut a, body).await;
    let mut body = payload(
        &a,
        &board,
        "checkpoint",
        1100,
        1,
        Some(&s["executionTracking"]),
    );
    body["usageReport"]["entries"][0]["modelId"] = json!("model-two");
    step(&app, &mut a, body).await;
    let mut body = payload(
        &a,
        &board,
        "checkpoint",
        10,
        2,
        Some(&s["executionTracking"]),
    );
    body["usageReport"]["entries"][0]["epoch"] = json!("reset");
    step(&app, &mut a, body).await;
    let mut body = payload(&a, &board, "finish", 60, 3, Some(&s["executionTracking"]));
    body["usageReport"]["entries"][0]["epoch"] = json!("reset");
    step(&app, &mut a, body).await;
    let u = usage(&app, &a).await;
    assert_eq!(u["validTotalTokens"], Value::Null);
    assert_eq!(u["partialTotalTokens"], "150");
    let r = intervals(&app, &a).await["items"][0].clone();
    assert_eq!(r["state"], "incomplete");
    assert_eq!(r["models"].as_array().unwrap().len(), 2);
    let path = format!(
        "/api/v1/tasks/{}/execution-intervals/{}/revisions",
        id(&a),
        id(&r)
    );
    let revised = ok(
        &app,
        "POST",
        &path,
        json!({"reason":"Coverage untrustworthy; preserve audit","invalidate":true}),
        ver(&r),
    )
    .await;
    assert_eq!(revised["state"], "invalid");
    let history = get(&app, &path).await;
    assert_eq!(history["total"], 4);
    assert!(history["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v["interval"]["partialTokens"] == "150"));
}

#[tokio::test]
async fn concurrent_start_replay_mcp_success_and_closed_overlap() {
    let (app, _, board, a, b) = setup().await;
    let bodya = payload(&a, &board, "start", 1000, 0, None);
    let mut bodyb = payload(&b, &board, "start", 1000, 0, None);
    bodyb["usageReport"]["entries"][0]["evidenceId"] = json!("different");
    bodyb["executionTracking"]["evidenceIds"] = json!(["different"]);
    let pa = format!("/api/v1/tasks/{}/execution-summaries", id(&a));
    let pb = format!("/api/v1/tasks/{}/execution-summaries", id(&b));
    let key = uuid::Uuid::new_v4();
    let (ra, rb) = tokio::join!(
        request_key(&app, "POST", &pa, bodya.clone(), ver(&a), key),
        request(&app, "POST", &pb, bodyb.clone(), ver(&b))
    );
    assert_eq!(
        [ra.0, rb.0].iter().filter(|s| **s == 201).count(),
        1,
        "{ra:?} {rb:?}"
    );
    let (mut task, start, path) = if ra.0 == 201 {
        (
            ra.1["task"].clone(),
            ra.1["executionSummary"].clone(),
            pa.clone(),
        )
    } else {
        (
            rb.1["task"].clone(),
            rb.1["executionSummary"].clone(),
            pb.clone(),
        )
    };
    if ra.0 == 201 {
        let replay = request_key(&app, "POST", &pa, bodya, ver(&a), key).await;
        assert_eq!(replay, ra);
    }
    let body = payload(
        &task,
        &board,
        "finish",
        1600,
        5,
        Some(&start["executionTracking"]),
    );
    let args = json!({"params":{"taskId":id(&task)},"body":body,"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4()});
    let result = tool(&app, "createExecutionSummary", args.clone()).await;
    assert_ne!(result["isError"], true, "{result}");
    assert_eq!(tool(&app, "createExecutionSummary", args).await, result);
    task = result["structuredContent"]["data"]["task"].clone();
    assert_eq!(usage(&app, &task).await["validTotalTokens"], "600");
    let before = intervals(&app, &task).await;
    let mut back = payload(&task, &board, "start", 2000, 3, None);
    back["usageReport"]["entries"][0]["epoch"] = json!("different-epoch");
    let rejected = request(&app, "POST", &path, back, ver(&task)).await;
    assert_eq!(rejected.0, 409, "{rejected:?}");
    assert_eq!(intervals(&app, &task).await, before);
}
#[tokio::test]
async fn correction_overflow_rolls_back_and_repeated_gap_is_rejected() {
    let (app, _, board, mut a, _) = setup().await;
    let body = payload(&a, &board, "start", 0, 0, None);
    let start = step(&app, &mut a, body).await;
    // A repeated real snapshot can be referenced, but cannot declare a new gap boundary.
    let mut gap = payload(
        &a,
        &board,
        "checkpoint",
        0,
        0,
        Some(&start["executionTracking"]),
    );
    gap["usageReport"] = json!({"entries":[start["usageReport"]["entries"][0]["observation"]]});
    gap["executionTracking"]["coverageLost"] = json!(true);
    gap["executionTracking"]["reason"] = json!("Lost coverage");
    let rejected = request(
        &app,
        "POST",
        &format!("/api/v1/tasks/{}/execution-summaries", id(&a)),
        gap,
        ver(&a),
    )
    .await;
    assert_eq!(rejected.0, 400, "{rejected:?}");
    let body = payload(
        &a,
        &board,
        "finish",
        1,
        1,
        Some(&start["executionTracking"]),
    );
    step(&app, &mut a, body).await;
    let original = intervals(&app, &a).await["items"][0].clone();
    let mut body = payload(&a, &board, "start", 0, 2, None);
    body["usageReport"]["entries"][0]["sessionId"] = json!("independent");
    body["executionTracking"]["coverageRootSessionId"] = json!("independent");
    let second = step(&app, &mut a, body).await;
    let mut body = payload(
        &a,
        &board,
        "finish",
        1,
        3,
        Some(&second["executionTracking"]),
    );
    body["usageReport"]["entries"][0]["sessionId"] = json!("independent");
    step(&app, &mut a, body).await;
    let mut body = payload(&a, &board, "checkpoint", i64::MAX, 4, None);
    body.as_object_mut().unwrap().remove("executionTracking");
    let candidate = step(&app, &mut a, body).await;
    let path = format!(
        "/api/v1/tasks/{}/execution-intervals/{}/revisions",
        id(&a),
        id(&original)
    );
    let revisions = get(&app, &path).await;
    let correction = json!({"reason":"Test overflow rollback","startEvidence":[{"summaryId":start["id"],"evidenceId":"e-0"}],"endEvidence":[{"summaryId":candidate["id"],"evidenceId":"e-4"}]});
    let result = request(&app, "POST", &path, correction, ver(&original)).await;
    assert_eq!(result.0, 400, "{result:?}");
    assert_eq!(get(&app, &path).await, revisions);
    assert_eq!(usage(&app, &a).await["validTotalTokens"], "2");
}
#[tokio::test]
async fn explicit_gap_segments_and_tree_child_exclusion() {
    let (app, _, board, mut a, mut b) = setup().await;
    let mut body = payload(&a, &board, "start", 1000, 0, None);
    body["usageReport"]["entries"][0]["scope"] = json!("session_tree");
    let start = step(&app, &mut a, body).await;
    let mut child = payload(&b, &board, "start", 100, 1, None);
    child["usageReport"]["entries"][0]["sessionId"] = json!("child");
    let result = request(
        &app,
        "POST",
        &format!("/api/v1/tasks/{}/execution-summaries", id(&b)),
        child,
        ver(&b),
    )
    .await;
    assert_eq!(result.0, 409, "{result:?}");
    let mut body = payload(
        &a,
        &board,
        "checkpoint",
        1300,
        2,
        Some(&start["executionTracking"]),
    );
    body["usageReport"]["entries"][0]["scope"] = json!("session_tree");
    step(&app, &mut a, body).await;
    let mut body = payload(
        &a,
        &board,
        "checkpoint",
        2000,
        3,
        Some(&start["executionTracking"]),
    );
    body["usageReport"]["entries"][0]["scope"] = json!("session_tree");
    body["executionTracking"]["coverageLost"] = json!(true);
    body["executionTracking"]["reason"] = json!("Recovered after agent interruption");
    step(&app, &mut a, body).await;
    let mut body = payload(
        &a,
        &board,
        "finish",
        2200,
        4,
        Some(&start["executionTracking"]),
    );
    body["usageReport"]["entries"][0]["scope"] = json!("session_tree");
    step(&app, &mut a, body).await;
    assert_eq!(usage(&app, &a).await["partialTotalTokens"], "500");
    assert_eq!(usage(&app, &a).await["validTotalTokens"], Value::Null);
    let mut body = payload(&b, &board, "start", 0, 5, None);
    body["usageReport"]["entries"][0]["sessionId"] = json!("child");
    let _ = step(&app, &mut b, body).await;
}

#[tokio::test]
async fn per_model_corrections_keep_each_summary_reference_and_received_time() {
    let (app, _, board, mut a, _) = setup().await;
    let mut boundaries = Vec::new();
    for (model, t, n) in [("first", 0, 10), ("second", 0, 20)] {
        let mut body = payload(&a, &board, "start", n, t, None);
        body.as_object_mut().unwrap().remove("executionTracking");
        let entry = &mut body["usageReport"]["entries"][0];
        entry["modelId"] = json!(model);
        entry["evidenceId"] = json!(format!("{model}-start"));
        boundaries.push(step(&app, &mut a, body).await);
    }
    let mut body = payload(&a, &board, "start", 30, 1, None);
    body["executionTracking"]["counterMode"] = json!("per_model");
    body["usageReport"]["entries"][0]["modelId"] = json!("first");
    let mut second = body["usageReport"]["entries"][0].clone();
    second["modelId"] = json!("second");
    second["evidenceId"] = json!("second-1");
    body["usageReport"]["entries"]
        .as_array_mut()
        .unwrap()
        .push(second);
    body["executionTracking"]["evidenceIds"] = json!(["e-1", "second-1"]);
    let start = step(&app, &mut a, body).await;
    let mut body = payload(
        &a,
        &board,
        "finish",
        40,
        2,
        Some(&start["executionTracking"]),
    );
    body["usageReport"]["entries"][0]["modelId"] = json!("first");
    let mut second = body["usageReport"]["entries"][0].clone();
    second["modelId"] = json!("second");
    second["evidenceId"] = json!("second-2");
    body["usageReport"]["entries"]
        .as_array_mut()
        .unwrap()
        .push(second);
    body["executionTracking"]["evidenceIds"] = json!(["e-2", "second-2"]);
    step(&app, &mut a, body).await;
    let mut ends = Vec::new();
    for model in ["first", "second"] {
        let mut body = payload(&a, &board, "finish", 50, 3, None);
        body.as_object_mut().unwrap().remove("executionTracking");
        let e = &mut body["usageReport"]["entries"][0];
        e["modelId"] = json!(model);
        e["evidenceId"] = json!(format!("{model}-end"));
        ends.push(step(&app, &mut a, body).await);
    }
    let original = intervals(&app, &a).await["items"][0].clone();
    let path = format!(
        "/api/v1/tasks/{}/execution-intervals/{}/revisions",
        id(&a),
        id(&original)
    );
    let body = json!({"reason":"Verified original per-model boundaries","startEvidence":[{"summaryId":boundaries[0]["id"],"evidenceId":"first-start"},{"summaryId":boundaries[1]["id"],"evidenceId":"second-start"}],"endEvidence":[{"summaryId":ends[0]["id"],"evidenceId":"first-end"},{"summaryId":ends[1]["id"],"evidenceId":"second-end"}]});
    let corrected = ok(&app, "POST", &path, body, ver(&original)).await;
    assert_eq!(corrected["totalTokens"], "70");
    let persisted=get(&app,&format!("/api/v1/tasks/{}/execution-summaries",id(&a))).await;
    let received=|sid:&Value|persisted["items"].as_array().unwrap().iter().find(|v|v["id"]==*sid).unwrap()["createdAt"].clone();
    assert_eq!(corrected["startReceivedAt"],received(&boundaries[0]["id"]));
    assert_eq!(corrected["endReceivedAt"],received(&ends[0]["id"]));
    let counters = corrected["counters"].as_array().unwrap();
    for (index, model) in ["first", "second"].iter().enumerate() {
        let c = counters
            .iter()
            .find(|c| c["counterKey"].as_str().unwrap().contains(model))
            .unwrap();
        assert_eq!(c["segments"][0]["startSummaryId"], boundaries[index]["id"]);
        assert_eq!(c["segments"][0]["latestSummaryId"], ends[index]["id"]);
    }
    assert_eq!(usage(&app, &a).await["validTotalTokens"], "70");
}
#[tokio::test]
async fn independent_sessions_duration_union_and_page_independent_totals() {
    let (app, _, board, mut a, _) = setup().await;
    for session in ["one", "two"] {
        let mut body = payload(&a, &board, "start", 0, 0, None);
        body["usageReport"]["entries"][0]["sessionId"] = json!(session);
        body["executionTracking"]["coverageRootSessionId"] = json!(session);
        let start = step(&app, &mut a, body).await;
        let mut body = payload(
            &a,
            &board,
            "finish",
            0,
            10,
            Some(&start["executionTracking"]),
        );
        body["usageReport"]["entries"][0]["sessionId"] = json!(session);
        step(&app, &mut a, body).await;
    }
    let u = usage(&app, &a).await;
    assert_eq!(u["validTotalTokens"], "0");
    assert_eq!(u["observedDurationMs"], "20000");
    assert_eq!(u["elapsedDurationMs"], "10000");
    assert_eq!(u["coverage"]["validIntervals"], 2);
    let page = get(
        &app,
        &format!("/api/v1/tasks/{}/execution-intervals?limit=1", id(&a)),
    )
    .await;
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    assert_eq!(page["total"], 2);
}

#[tokio::test]
async fn correction_cannot_overlap_another_tasks_closed_range() {
    let (app, _, board, mut a, mut b) = setup().await;
    let body = payload(&a, &board, "start", 1000, 0, None);
    let astart = step(&app, &mut a, body).await;
    let body = payload(
        &a,
        &board,
        "finish",
        1300,
        1,
        Some(&astart["executionTracking"]),
    );
    step(&app, &mut a, body).await;
    let body = payload(&b, &board, "start", 1400, 2, None);
    let bstart = step(&app, &mut b, body).await;
    let body = payload(
        &b,
        &board,
        "finish",
        1600,
        3,
        Some(&bstart["executionTracking"]),
    );
    step(&app, &mut b, body).await;
    let mut body = payload(&a, &board, "finish", 1800, 4, None);
    body.as_object_mut().unwrap().remove("executionTracking");
    let late = step(&app, &mut a, body).await;
    let original = intervals(&app, &a).await["items"][0].clone();
    let path = format!(
        "/api/v1/tasks/{}/execution-intervals/{}/revisions",
        id(&a),
        id(&original)
    );
    let before = get(&app, &path).await;
    let body = json!({"reason":"Must not overlap B","startEvidence":[{"summaryId":astart["id"],"evidenceId":"e-0"}],"endEvidence":[{"summaryId":late["id"],"evidenceId":"e-4"}]});
    let result = request(&app, "POST", &path, body, ver(&original)).await;
    assert_eq!(result.0, 409, "{result:?}");
    assert_eq!(get(&app, &path).await, before);
    assert_eq!(usage(&app, &a).await["validTotalTokens"], "300");
}
