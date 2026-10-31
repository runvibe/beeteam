#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn setup() -> (Router, Value, Value, Value) {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Usage fixture"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Usage","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Usage","teamId":id(&team)}),
        None,
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Usage task","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    (app, agent, board, task)
}
fn execution(task: &Value, board: &Value) -> Value {
    json!({"summary":"Historical Markdown","currentSummary":"Current synthesis","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(task),"originBoardId":id(board)}})
}
async fn tool(app: &Router, name: &str, args: Value) -> Value {
    let r=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice::<Value>(&r.into_body().collect().await.unwrap().to_bytes()).unwrap()
        ["result"]
        .clone()
}

fn observation(
    actor: &str,
    evidence: &str,
    previous: Option<&str>,
    input: &str,
    output: &str,
) -> Value {
    json!({"source":"fixture-only","harness":"codex","surface":"cli","harnessVersion":"fixture-v1",
        "sessionId":"isolated-session","epoch":"epoch-1","evidenceId":evidence,"previousEvidenceId":previous,
        "actor":{"kind":"agent","id":actor},"actorRole":"collaborator","provider":"openai","modelId":"fixture-model",
        "scope":"session","reportKind":"cumulative_snapshot","quality":"measured","attribution":"exact",
        "observedAt":"2026-10-31T00:00:00Z","periodStart":null,"periodEnd":null,
        "inputTokens":input,"outputTokens":output,"cachedInputTokens":null,"reasoningOutputTokens":null,"discovery":null})
}

#[tokio::test]
async fn summary_usage_snapshots_deduplicate_without_status_or_markdown_inference() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Usage fixture"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Usage","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Usage","teamId":id(&team)}),
        None,
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Usage task","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let body = |entries: Vec<Value>| json!({"summary":"Markdown remains separate","currentSummary":"Fixture work synthesis","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&task),"originBoardId":id(&board)},"usageReport":{"entries":entries}});
    let first = observation(id(&agent), "sample-1", None, "1000", "100");
    let r1 = ok(&app, "POST", &route, body(vec![first.clone()]), ver(&task)).await;
    assert!(r1["executionSummary"]["usageReport"]["entries"][0]["delta"].is_null());
    let mut second = observation(id(&agent), "sample-2", Some("sample-1"), "1300", "160");
    second["observedAt"] = json!("2026-10-31T00:01:00Z");
    let r2 = ok(
        &app,
        "POST",
        &route,
        body(vec![second.clone()]),
        ver(&r1["task"]),
    )
    .await;
    assert_eq!(
        r2["executionSummary"]["usageReport"]["entries"][0]["delta"]["totalTokens"],
        "360"
    );
    let r3 = ok(&app, "POST", &route, body(vec![second]), ver(&r2["task"])).await;
    assert_eq!(r3["task"]["statusId"], task["statusId"]);
    assert_eq!(
        r3["executionSummary"]["summary"],
        "Markdown remains separate"
    );
    let overview = get(&app, &format!("/api/v1/tasks/{}/overview", id(&task))).await;
    assert_eq!(overview["usage"]["knownTotalTokens"], "360");
    assert_eq!(overview["usage"]["models"]["total"], 1);
    assert_eq!(overview["usage"]["timeline"]["total"], 3);
    assert_eq!(
        overview["usage"]["timeline"]["items"][0]["statusObserved"]["id"],
        task["statusId"]
    );
}

#[tokio::test]
async fn optional_reports_late_evidence_replay_and_transport_parity() {
    let (app, agent, board, task) = setup().await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let key = uuid::Uuid::new_v4();
    let original = execution(&task, &board);
    let (status, first) =
        request_key(&app, "POST", &route, original.clone(), ver(&task), key).await;
    assert_eq!(status, 201);
    let summary = &first["executionSummary"];
    assert!(summary.get("usageReport").is_none());
    let before = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    let empty = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert!(empty["knownTotalTokens"].is_null());
    assert_eq!(empty["coverage"]["missingSummaries"], 1);
    let mut entry = observation(id(&agent), "request-1", None, "20", "5");
    entry["scope"] = json!("request");
    entry["reportKind"] = json!("period_delta");
    entry["actorRole"] = json!("leader");
    let late_route = format!("{}/{}/usage-revisions", route, id(summary));
    let late_key = uuid::Uuid::new_v4();
    let payload = json!({"entries":[entry.clone()]});
    let (status, late) = request_key(
        &app,
        "POST",
        &late_route,
        payload.clone(),
        Some(1),
        late_key,
    )
    .await;
    assert_eq!(status, 200, "{late}");
    assert_eq!(late["summary"], summary["summary"]);
    assert_eq!(late["usageReport"]["revision"], 1);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&task))).await,
        before
    );
    let replay = request_key(&app, "POST", &late_route, payload, Some(1), late_key).await;
    assert_eq!(replay.1, late);
    let old_replay = request_key(&app, "POST", &route, original, ver(&task), key).await;
    assert_eq!(
        old_replay.1, first,
        "Saved pre-report response must remain exact after reconciliation"
    );
    let data = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert_eq!(data["knownTotalTokens"], "25");
    let rpc = tool(&app, "getTaskUsage", json!({"params":{"taskId":id(&task)}})).await;
    assert_eq!(rpc["isError"], false, "{rpc}");
    assert_eq!(rpc["structuredContent"]["data"], data);
    let models = get(
        &app,
        &format!(
            "/api/v1/tasks/{}/usage/dimensions?kind=model&limit=1",
            id(&task)
        ),
    )
    .await;
    assert_eq!(models["total"], 1);
    assert_eq!(models["items"][0]["modelId"], "fixture-model");
    let mut other = entry.clone();
    other["evidenceId"] = json!("request-2");
    other["modelId"] = json!("another-model");
    other["harness"] = json!("cursor");
    other["sessionId"] = json!("other-session");
    other["quality"] = json!("estimated");
    let rpc=tool(&app,"reconcileSummaryUsage",json!({"params":{"taskId":id(&task),"summaryId":id(summary)},"actor":{"kind":"human"},"expectedVersion":late["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":{"entries":[other]}})).await;
    assert_eq!(rpc["isError"], false, "{rpc}");
    let supplemented = &rpc["structuredContent"]["data"];
    assert_eq!(
        supplemented["usageReport"]["entries"][0],
        late["usageReport"]["entries"][0]
    );
    assert_eq!(
        supplemented["usageReport"]["reportedAt"],
        late["usageReport"]["reportedAt"]
    );
    assert_eq!(supplemented["usageReport"]["revision"], 2);
    let data = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert_eq!(data["knownTotalTokens"], "25");
    assert_eq!(data["estimatedTotalTokens"], "25");
    assert_eq!(data["models"]["total"], 2);
    assert_eq!(data["harnesses"]["total"], 2);
    assert_eq!(data["timeline"]["total"], 1);
}

#[tokio::test]
async fn invalid_or_overlapping_evidence_rolls_back_and_unavailable_is_not_zero() {
    let (app, agent, board, task) = setup().await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let mut body = execution(&task, &board);
    let mut missing = observation(id(&agent), "none", None, "0", "0");
    missing["reportKind"] = json!("unavailable");
    missing["quality"] = json!("unavailable");
    body["usageReport"] = json!({"entries":[missing.clone()]});
    assert_eq!(
        request(&app, "POST", &route, body.clone(), ver(&task))
            .await
            .0,
        400
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&task))).await,
        task
    );
    for k in ["inputTokens", "outputTokens"] {
        missing[k] = Value::Null;
    }
    missing["modelId"] = Value::Null;
    missing["discovery"] = json!({"reason":"Isolated fixture has no harness stream","attempts":["Inspected fixture tool inventory and documented metadata source"]});
    body["usageReport"] = json!({"entries":[missing]});
    let first = ok(&app, "POST", &route, body, ver(&task)).await;
    let data = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert!(data["knownTotalTokens"].is_null());
    assert_eq!(data["coverage"]["unavailableEntries"], 1);
    assert_eq!(data["models"]["total"], 0);
    let mut body = execution(&task, &board);
    let a = observation(id(&agent), "a", None, "100", "10");
    body["usageReport"] = json!({"entries":[a]});
    let baseline = ok(&app, "POST", &route, body.clone(), ver(&first["task"])).await;
    let mut b = observation(id(&agent), "b", Some("a"), "90", "11");
    b["observedAt"] = json!("2026-10-31T00:01:00Z");
    body["usageReport"] = json!({"entries":[b.clone()]});
    assert_eq!(
        request(&app, "POST", &route, body.clone(), ver(&baseline["task"]))
            .await
            .0,
        400
    );
    b["inputTokens"] = json!("150");
    body["usageReport"] = json!({"entries":[b.clone()]});
    let second = ok(&app, "POST", &route, body.clone(), ver(&baseline["task"])).await;
    let mut fork = b.clone();
    fork["evidenceId"] = json!("fork");
    fork["inputTokens"] = json!("160");
    body["usageReport"] = json!({"entries":[fork]});
    assert_eq!(
        request(&app, "POST", &route, body, ver(&second["task"]))
            .await
            .0,
        400
    );
    b["inputTokens"] = json!("151");
    let mut changed = execution(&task, &board);
    changed["usageReport"] = json!({"entries":[b]});
    assert_eq!(
        request(&app, "POST", &route, changed, ver(&second["task"]))
            .await
            .0,
        409
    );
    let after = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert_eq!(after["knownTotalTokens"], "51");
    assert_eq!(after["timeline"]["total"], 3);
}

#[tokio::test]
async fn sql_totals_and_dimensions_cover_more_than_one_page() {
    let (app, agent, board, task) = setup().await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let mut current = task.clone();
    for batch in 0..4 {
        let mut entries = Vec::new();
        for i in batch * 32..((batch + 1) * 32).min(105) {
            let mut e = observation(id(&agent), &format!("request-{i}"), None, "1", "1");
            e["scope"] = json!("request");
            e["reportKind"] = json!("period_delta");
            e["modelId"] = json!(format!("model-{i:03}"));
            e["sessionId"] = json!(format!("session-{i}"));
            entries.push(e);
        }
        let mut body = execution(&task, &board);
        body["usageReport"] = json!({"entries":entries});
        current = ok(&app, "POST", &route, body, ver(&current)).await["task"].clone();
    }
    let data = get(&app, &format!("/api/v1/tasks/{}/usage?limit=1", id(&task))).await;
    assert_eq!(data["knownTotalTokens"], "210");
    assert_eq!(data["models"]["total"], 105);
    assert_eq!(data["models"]["items"].as_array().unwrap().len(), 100);
    assert_eq!(data["models"]["truncated"], true);
    assert_eq!(data["timeline"]["total"], 4);
    assert_eq!(data["timeline"]["items"].as_array().unwrap().len(), 1);
    let page = get(
        &app,
        &format!(
            "/api/v1/tasks/{}/usage/dimensions?kind=model&offset=100&limit=10",
            id(&task)
        ),
    )
    .await;
    assert_eq!(page["items"].as_array().unwrap().len(), 5);
    assert_eq!(page["truncated"], false);
}

#[tokio::test]
async fn close_activity_usage_validation_is_atomic_with_comments_and_status() {
    let (app, agent, board, task) = setup().await;
    let mut e = observation(id(&agent), "invalid", None, "10", "1");
    e["cachedInputTokens"] = json!("11");
    let mut body = execution(&task, &board);
    body["usageReport"] = json!({"entries":[e]});
    let result=tool(&app,"close_activity",json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must roll back","execution":body})).await;
    assert_eq!(result["isError"], true);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&task))).await,
        task
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(&task))).await["total"],
        0
    );
    assert_eq!(
        get(
            &app,
            &format!("/api/v1/tasks/{}/execution-summaries", id(&task))
        )
        .await["total"],
        0
    );
    let success=tool(&app,"close_activity",json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"execution":execution(&task,&board)})).await;
    assert_eq!(
        success["isError"], false,
        "Optional metadata must not block summary: {success}"
    );
}

#[tokio::test]
async fn task_aggregate_overflow_and_parallel_source_overlap_are_rejected() {
    let (app, agent, board, task) = setup().await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let mut e = observation(id(&agent), "max", None, &i64::MAX.to_string(), "0");
    e["scope"] = json!("request");
    e["reportKind"] = json!("period_delta");
    let mut body = execution(&task, &board);
    body["usageReport"] = json!({"entries":[e.clone()]});
    let first = ok(&app, "POST", &route, body.clone(), ver(&task)).await;
    let data = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert_eq!(data["knownTotalTokens"], i64::MAX.to_string());
    e["inputTokens"] = json!("1");
    e["evidenceId"] = json!("over");
    body["usageReport"] = json!({"entries":[e.clone()]});
    assert_eq!(
        request(&app, "POST", &route, body.clone(), ver(&first["task"]))
            .await
            .0,
        400
    );
    e["inputTokens"] = json!("0");
    e["source"] = json!("overlapping-sdk");
    body["usageReport"] = json!({"entries":[e]});
    assert_eq!(
        request(&app, "POST", &route, body, ver(&first["task"]))
            .await
            .0,
        400
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&task))).await,
        first["task"]
    );
}
