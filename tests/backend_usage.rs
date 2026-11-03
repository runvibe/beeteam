#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn setup() -> (Router, Value, Value, Value) {
    setup_on(app().await).await
}
async fn setup_on(app: Router) -> (Router, Value, Value, Value) {
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
    json!({"commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(task["executorAgentId"].as_str().unwrap()),"summary":"Historical Markdown","currentSummary":"Current synthesis","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(task),"originBoardId":id(board)}})
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
        "inputTokens":input,"outputTokens":output,"totalTokens":(input.parse::<i64>().unwrap()+output.parse::<i64>().unwrap()).to_string(),"cachedInputTokens":null,"reasoningOutputTokens":null,"discovery":null})
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
    let body = |entries: Vec<Value>| json!({"summary":"Markdown remains separate","currentSummary":"Fixture work synthesis","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&task),"originBoardId":id(&board)},"commitReport":{"hasCommits":false,"commits":[]},"usageReport":{"entries":entries}});
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
async fn baseline_reports_late_evidence_replay_and_transport_parity() {
    let (app, agent, board, task) = setup().await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let key = uuid::Uuid::new_v4();
    let original = execution(&task, &board);
    let (status, first) =
        request_key(&app, "POST", &route, original.clone(), ver(&task), key).await;
    assert_eq!(status, 201);
    let summary = &first["executionSummary"];
    assert_eq!(
        summary["usageReport"]["entries"][0]["observation"]["reportKind"],
        "cumulative_snapshot"
    );
    let before = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    let empty = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert!(empty["knownTotalTokens"].is_null());
    assert_eq!(empty["coverage"]["missingSummaries"], 0);
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
    assert_eq!(late["usageReport"]["revision"], 2);
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
    assert_eq!(supplemented["usageReport"]["revision"], 3);
    let data = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert_eq!(data["knownTotalTokens"], "25");
    assert_eq!(data["estimatedTotalTokens"], "25");
    assert_eq!(data["models"]["total"], 2);
    assert_eq!(data["harnesses"]["total"], 3);
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
    let mut blank=missing.clone();
    blank["discovery"]["attempts"]=json!(["   "]);
    body["usageReport"]=json!({"entries":[blank]});
    assert_eq!(request(&app,"POST",&route,body.clone(),ver(&task)).await.0,400);
    body["usageReport"] = json!({"entries":[missing]});
    assert_eq!(request(&app,"POST",&route,body,ver(&task)).await.0,400);
    let first = ok(&app,"POST",&route,execution(&task,&board),ver(&task)).await;
    let data=get(&app,&format!("/api/v1/tasks/{}/usage",id(&task))).await;
    assert!(data["knownTotalTokens"].is_null());
    assert_eq!(data["coverage"]["unavailableEntries"],0);
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
    b["inputTokens"] = json!("150"); b["totalTokens"] = json!("161");
    body["usageReport"] = json!({"entries":[b.clone()]});
    let second = ok(&app, "POST", &route, body.clone(), ver(&baseline["task"])).await;
    let mut fork = b.clone();
    fork["evidenceId"] = json!("fork");
    fork["inputTokens"] = json!("160"); fork["totalTokens"] = json!("171");
    body["usageReport"] = json!({"entries":[fork]});
    assert_eq!(
        request(&app, "POST", &route, body, ver(&second["task"]))
            .await
            .0,
        400
    );
    b["inputTokens"] = json!("151"); b["totalTokens"] = json!("162");
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
    for batch in 0..7 {
        let mut entries = Vec::new();
        for i in batch * 16..((batch + 1) * 16).min(105) {
            let mut e = observation(id(&agent), &format!("request-{i}"), None, "1", "1");
            e["modelId"] = json!(format!("model-{i:03}"));
            e["sessionId"] = json!(format!("session-{i}"));
            let mut base=e.clone();base["evidenceId"]=json!(format!("base-{i}"));base["inputTokens"]=json!("0");base["outputTokens"]=json!("0");base["totalTokens"]=json!("0");
            e["previousEvidenceId"]=base["evidenceId"].clone();e["observedAt"]=json!("2026-10-31T01:00:00Z");
            entries.push(base);entries.push(e);
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
    assert_eq!(data["timeline"]["total"], 7);
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
        "Measured initial snapshot must allow summary: {success}"
    );
}

#[tokio::test]
async fn task_aggregate_overflow_and_parallel_source_overlap_are_rejected() {
    let (app, agent, board, task) = setup().await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let first=ok(&app,"POST",&route,execution(&task,&board),ver(&task)).await;
    let late=format!("{}/{}/usage-revisions",route,id(&first["executionSummary"]));
    let mut e=observation(id(&agent),"max",None,&i64::MAX.to_string(),"0");
    e["scope"]=json!("request");e["reportKind"]=json!("period_delta");
    let revised=ok(&app,"POST",&late,json!({"entries":[e.clone()]}),Some(1)).await;
    assert_eq!(get(&app,&format!("/api/v1/tasks/{}/usage",id(&task))).await["knownTotalTokens"],i64::MAX.to_string());
    e["inputTokens"]=json!("1");e["totalTokens"]=json!("1");e["evidenceId"]=json!("over");
    assert_eq!(request(&app,"POST",&late,json!({"entries":[e.clone()]}),ver(&revised)).await.0,400);
    e["inputTokens"]=json!("0");e["totalTokens"]=json!("0");e["source"]=json!("overlapping-sdk");
    assert_eq!(request(&app,"POST",&late,json!({"entries":[e]}),ver(&revised)).await.0,400);
    assert_eq!(get(&app,&format!("/api/v1/tasks/{}",id(&task))).await,first["task"]);
}

#[tokio::test]
async fn new_summaries_require_explicit_usage_in_http_mcp_and_compound() {
    let (app, _, board, task) = setup().await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    for report in [None, Some(Value::Null), Some(json!({"entries":[]}))] {
        let mut body = execution(&task, &board);
        body.as_object_mut().unwrap().remove("usageReport");
        if let Some(report) = report {
            body["usageReport"] = report;
        }
        let (status, error) = request(&app, "POST", &route, body.clone(), ver(&task)).await;
        assert_eq!(status, 400, "{error}");
        assert!(error.to_string().contains("usageReport"), "{error}");
        let args = json!({"params":{"taskId":id(&task)},"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":body});
        let rpc = tool(&app, "createExecutionSummary", args).await;
        assert_eq!(rpc["isError"], true, "{rpc}");
        assert!(rpc.to_string().contains("usageReport"));
        let rpc=tool(&app,"close_activity",json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must not survive missing usage","execution":body})).await;
        assert_eq!(rpc["isError"], true, "{rpc}");
        assert!(rpc.to_string().contains("usageReport"));
    }
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&task))).await,
        task
    );
    assert_eq!(get(&app, &route).await["total"], 0);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(&task))).await["total"],
        0
    );
    let rpc=tool(&app,"createExecutionSummary",json!({"params":{"taskId":id(&task)},"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":execution(&task,&board)})).await;
    assert_eq!(rpc["isError"],false,"{rpc}");
    assert_eq!(rpc["structuredContent"]["data"]["executionSummary"]["usageReport"]["entries"][0]["observation"]["reportKind"],"cumulative_snapshot");

}

#[tokio::test]
async fn historical_missing_usage_and_saved_replays_survive_required_write_contract() {
    use beeteam::dto::backend::Outcome;
    use beeteam::repositories::sqlite::ResourceRepository;
    use sha2::{Digest, Sha256};
    let (app, pool) = sqlite_app_with_pool().await;
    let (app, _, board, task) = setup_on(app).await;
    let route = format!("/api/v1/tasks/{}/execution-summaries", id(&task));
    let mut legacy = execution(&task, &board);
    let first = ok(&app, "POST", &route, legacy.clone(), ver(&task)).await;
    legacy.as_object_mut().unwrap().remove("usageReport");
    legacy.as_object_mut().unwrap().remove("commitReport");
    let mut snapshot = first.clone();
    snapshot["executionSummary"].as_object_mut().unwrap().remove("commitReport");
    snapshot["executionSummary"]
        .as_object_mut()
        .unwrap()
        .remove("usageReport");
    let repo = ResourceRepository::new(pool.clone());
    let sid = uuid::Uuid::parse_str(id(&first["executionSummary"])).unwrap();
    let mut unit = repo.begin().await.unwrap();
    unit.records
        .get_mut("execution_summaries", sid)
        .unwrap()
        .data
        .as_object_mut()
        .unwrap()
        .remove("usageReport");
    unit.records.get_mut("execution_summaries", sid).unwrap().data.as_object_mut().unwrap().remove("commitReport");
    let direct_key = uuid::Uuid::new_v4();
    let params = json!({"taskId":id(&task)});
    let hash = |v: &Value| {
        Sha256::digest(serde_json::to_vec(v).unwrap())
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    };
    unit.save_replay(
        "human:",
        &format!("createExecutionSummary:{}", params),
        direct_key,
        &hash(&json!([legacy, params, {}])),
        &Outcome::data(snapshot.clone()),
    )
    .await
    .unwrap();
    let close_key = uuid::Uuid::new_v4();
    let close = json!({"taskId":id(&task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":close_key,"execution":legacy});
    let closed = json!({"task":first["task"],"updatedTasks":[first["task"]],"notice":"Historical response."});
    unit.save_replay(
        "human:",
        &format!("close_activity:{}", id(&task)),
        close_key,
        &hash(&close),
        &Outcome::data(closed.clone()),
    )
    .await
    .unwrap();
    unit.commit().await.unwrap();
    let before = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    assert_eq!(get(&app, &route).await["items"][0].get("usageReport"), None);
    assert_eq!(get(&app, &route).await["items"][0].get("commitReport"), None);
    let usage = get(&app, &format!("/api/v1/tasks/{}/usage", id(&task))).await;
    assert_eq!(usage["coverage"]["missingSummaries"], 1);
    assert!(usage["knownTotalTokens"].is_null());
    let (_, replayed) =
        request_key(&app, "POST", &route, legacy.clone(), ver(&task), direct_key).await;
    assert_eq!(replayed, snapshot);
    let rpc=tool(&app,"createExecutionSummary",json!({"params":params,"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":direct_key,"body":legacy})).await;
    assert_eq!(rpc["isError"], false, "{rpc}");
    assert_eq!(rpc["structuredContent"]["data"], snapshot);
    let rpc = tool(&app, "close_activity", close).await;
    assert_eq!(rpc["isError"], false, "{rpc}");
    assert_eq!(rpc["structuredContent"], closed);
    assert_eq!(
        request(&app, "POST", &route, legacy, ver(&before)).await.0,
        400
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&task))).await,
        before
    );
    assert_eq!(get(&app, &route).await["total"], 1);
}

#[test]
fn summary_mcp_tools_explain_required_snapshot_and_collection_failure() {
    let catalog=beeteam::routes::mcp::catalog();
    for name in ["createExecutionSummary","close_activity"] {
        let tool=catalog["tools"].as_array().unwrap().iter().find(|t|t["name"]==name).unwrap();
        let description=tool["description"].as_str().unwrap();
        for term in ["usageReport","totalTokens","modelId","actor.kind","session","baseline","Codex","Copilot","Claude","Cursor","Kiro","unavailable"] {
            assert!(description.contains(term),"{name} description missing {term}");
        }
    }
}

#[tokio::test]
async fn required_session_snapshot_contract_has_http_mcp_parity_and_no_partial_writes() {
    let (app,agent,board,task)=setup().await;
    let path=format!("/api/v1/tasks/{}",id(&task));
    let route=format!("{path}/execution-summaries");
    let valid=execution(&task,&board);
    let history=get(&app,&format!("{path}/timeline")).await;
    let mut invalid_reports=vec![unavailable_usage()];
    for (field,value) in [
        ("totalTokens",Value::Null),("totalTokens",json!(120)),("totalTokens",json!("155")),
        ("inputTokens",Value::Null),("outputTokens",Value::Null),("modelId",Value::Null),
        ("modelId",json!("  ")),("quality",json!("estimated")),("scope",json!("request")),
        ("reportKind",json!("period_delta")),("actor",json!({"kind":"human","id":null})),
    ] {
        let mut report=valid["usageReport"].clone();report["entries"][0][field]=value;
        invalid_reports.push(report);
    }
    let mut omitted=valid["usageReport"].clone();omitted["entries"][0].as_object_mut().unwrap().remove("totalTokens");invalid_reports.push(omitted);
    for report in invalid_reports {
        let mut body=valid.clone();body["usageReport"]=report;
        let (status,error)=request(&app,"POST",&route,body.clone(),ver(&task)).await;
        assert_eq!(status,400,"{error}");assert!(error.to_string().contains("totalTokens"),"{error}");
        let args=json!({"params":{"taskId":id(&task)},"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":body});
        let rpc=tool(&app,"createExecutionSummary",args).await;
        assert_eq!(rpc["isError"],true,"{rpc}");
        let rpc=tool(&app,"close_activity",json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must roll back","block":{"blocked":true,"reason":"Fixture"},"execution":body})).await;
        assert_eq!(rpc["isError"],true,"{rpc}");
    }
    assert_eq!(get(&app,&path).await,task);
    assert_eq!(get(&app,&format!("{path}/timeline")).await,history);
    assert_eq!(get(&app,&route).await["total"],0);
    assert_eq!(get(&app,&format!("{path}/comments")).await["total"],0);
    let mut unknown=valid.clone();unknown["usageReport"]["entries"][0]["actor"]["id"]=json!(uuid::Uuid::now_v7());
    assert_eq!(request(&app,"POST",&route,unknown,ver(&task)).await.0,404);
    let mut valid=valid;
    // Two disjoint models of one real session retain separate source counters.
    let mut second=valid["usageReport"]["entries"][0].clone();second["modelId"]=json!("second-model");second["evidenceId"]=json!(uuid::Uuid::new_v4());
    valid["usageReport"]["entries"].as_array_mut().unwrap().push(second);
    let first=ok(&app,"POST",&route,valid,ver(&task)).await;
    for entry in first["executionSummary"]["usageReport"]["entries"].as_array().unwrap() {
        assert_eq!(entry["observation"]["totalTokens"],"120");
        assert_eq!(entry["observation"]["actor"]["id"],agent["id"]);
        assert!(entry["delta"].is_null());
    }
    let usage=get(&app,&format!("{path}/usage")).await;
    assert!(usage["knownTotalTokens"].is_null());
    assert!(usage["recordedSessionUsage"]["measuredTotalTokens"].is_null());
    let mut tree=execution(&first["task"],&board);tree["usageReport"]["entries"][0]["scope"]=json!("session_tree");
    tree["usageReport"]["entries"][0]["inputTokens"]=json!("0");tree["usageReport"]["entries"][0]["outputTokens"]=json!("0");tree["usageReport"]["entries"][0]["totalTokens"]=json!("0");tree["usageReport"]["entries"][0]["cachedInputTokens"]=json!("0");tree["usageReport"]["entries"][0]["reasoningOutputTokens"]=json!("0");
    let rpc=tool(&app,"createExecutionSummary",json!({"params":{"taskId":id(&task)},"actor":{"kind":"human"},"expectedVersion":first["task"]["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":tree})).await;
    assert_eq!(rpc["isError"],false,"{rpc}");
    assert_eq!(rpc["structuredContent"]["data"]["executionSummary"]["usageReport"]["entries"][0]["observation"]["totalTokens"],"0");
}

#[tokio::test]
async fn legacy_partial_unavailable_and_missing_totals_remain_readable_and_replayable() {
    use beeteam::dto::backend::Outcome;
    use beeteam::repositories::sqlite::ResourceRepository;
    use sha2::{Digest,Sha256};
    let (app,pool)=sqlite_app_with_pool().await;
    let (app,_,board,task)=setup_on(app).await;
    let route=format!("/api/v1/tasks/{}/execution-summaries",id(&task));
    let original=execution(&task,&board);
    let first=ok(&app,"POST",&route,original.clone(),ver(&task)).await;
    for kind in ["missing_total","unknown_model","unavailable"] {
        let mut legacy=original.clone();
        match kind {
            "missing_total"=>{legacy["usageReport"]["entries"][0].as_object_mut().unwrap().remove("totalTokens");},
            "unknown_model"=>{legacy["usageReport"]["entries"][0]["modelId"]=Value::Null;},
            _=>{legacy["usageReport"]=unavailable_usage();},
        }
        let mut snapshot=first.clone();
        snapshot["executionSummary"]["usageReport"]["entries"][0]["observation"]=legacy["usageReport"]["entries"][0].clone();
        let repo=ResourceRepository::new(pool.clone());let mut unit=repo.begin().await.unwrap();
        let sid=uuid::Uuid::parse_str(id(&first["executionSummary"])).unwrap();
        unit.records.get_mut("execution_summaries",sid).unwrap().data["usageReport"]=snapshot["executionSummary"]["usageReport"].clone();
        let key=uuid::Uuid::new_v4();let params=json!({"taskId":id(&task)});
        let hash=|v:&Value|Sha256::digest(serde_json::to_vec(v).unwrap()).iter().map(|b|format!("{b:02x}")).collect::<String>();
        unit.save_replay("human:",&format!("createExecutionSummary:{params}"),key,&hash(&json!([legacy,params,{}])),&Outcome::data(snapshot.clone())).await.unwrap();
        let close=json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"execution":legacy});
        let closed=json!({"task":first["task"],"updatedTasks":[first["task"]],"notice":"Historical fixture."});
        unit.save_replay("human:",&format!("close_activity:{}",id(&task)),uuid::Uuid::parse_str(close["idempotencyKey"].as_str().unwrap()).unwrap(),&hash(&close),&Outcome::data(closed.clone())).await.unwrap();
        unit.commit().await.unwrap();
        assert_eq!(get(&app,&route).await["items"][0]["usageReport"],snapshot["executionSummary"]["usageReport"]);
        assert_eq!(request_key(&app,"POST",&route,legacy.clone(),ver(&task),key).await.1,snapshot);
        let rpc=tool(&app,"createExecutionSummary",json!({"params":params,"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":key,"body":legacy})).await;
        assert_eq!(rpc["structuredContent"]["data"],snapshot);
        assert_eq!(tool(&app,"close_activity",close).await["structuredContent"],closed);
        assert_eq!(request(&app,"POST",&route,legacy,ver(&first["task"])).await.0,400);
    }
    assert_eq!(get(&app,&route).await["total"],1);
    assert_eq!(get(&app,&format!("/api/v1/tasks/{}",id(&task))).await,first["task"]);
}

#[tokio::test]
async fn unallocated_session_delta_is_visible_without_task_attribution() {
    let (app,agent,board,mut task)=setup().await;
    let route=format!("/api/v1/tasks/{}/execution-summaries",id(&task));
    let mut baseline=observation(id(&agent),"session-baseline",None,"1069755","4036");
    baseline["attribution"]=json!("unallocated");
    let mut checkpoint=baseline.clone();checkpoint["evidenceId"]=json!("session-checkpoint");checkpoint["previousEvidenceId"]=json!("session-baseline");checkpoint["inputTokens"]=json!("2251066");checkpoint["outputTokens"]=json!("8764");checkpoint["totalTokens"]=json!("2259830");checkpoint["observedAt"]=json!("2026-10-31T01:00:00Z");
    for entry in [baseline,checkpoint.clone()] {
        let mut body=execution(&task,&board);body["usageReport"]=json!({"entries":[entry]});
        task=ok(&app,"POST",&route,body,ver(&task)).await["task"].clone();
    }
    let path=format!("/api/v1/tasks/{}/usage?limit=1",id(&task));
    let data=get(&app,&path).await;
    assert!(data["knownTotalTokens"].is_null());
    assert_eq!(data["recordedSessionUsage"]["measuredTotalTokens"],"1186039");
    assert_eq!(data["timeline"]["items"][0]["recordedSessionUsage"]["measuredTotalTokens"],"1186039");
    assert!(data["recordedSessionUsage"]["estimatedTotalTokens"].is_null());
    assert_eq!(data["recordedSessionUsage"]["coverage"],json!({"sessions":1,"baselineEntries":1,"deltaEntries":1,"duplicateEntries":0}));
    assert_eq!(get(&app,&format!("/api/v1/tasks/{}/overview",id(&task))).await["usage"]["recordedSessionUsage"],data["recordedSessionUsage"]);
    let baseline_page=get(&app,&format!("/api/v1/tasks/{}/usage?limit=1&offset=1",id(&task))).await;
    assert!(baseline_page["timeline"]["items"][0]["recordedSessionUsage"]["measuredTotalTokens"].is_null());
    assert_eq!(baseline_page["timeline"]["items"][0]["recordedSessionUsage"]["coverage"]["baselineEntries"],1);
    assert_eq!(baseline_page["recordedSessionUsage"],data["recordedSessionUsage"]);
    let mut body=execution(&task,&board);body["usageReport"]=json!({"entries":[checkpoint.clone()]});
    let duplicate=ok(&app,"POST",&route,body,ver(&task)).await;
    task=duplicate["task"].clone();
    ok(&app,"POST",&format!("{}/{}/usage-revisions",route,id(&duplicate["executionSummary"])),json!({"entries":[checkpoint]}),Some(1)).await;
    let mut other=observation(id(&agent),"other-baseline",None,"100","10");
    other["sessionId"]=json!("another-session");other["attribution"]=json!("shared");other["quality"]=json!("estimated");
    let mut next=other.clone();next["evidenceId"]=json!("other-next");next["previousEvidenceId"]=json!("other-baseline");next["inputTokens"]=json!("120");next["outputTokens"]=json!("15");next["totalTokens"]=json!("135");next["observedAt"]=json!("2026-10-31T01:00:00Z");
    ok(&app,"POST",&format!("{}/{}/usage-revisions",route,id(&duplicate["executionSummary"])),json!({"entries":[other,next]}),Some(2)).await;
    let data=get(&app,&path).await;
    assert!(data["knownTotalTokens"].is_null());assert!(data["estimatedTotalTokens"].is_null());
    assert_eq!(data["recordedSessionUsage"]["measuredTotalTokens"],"1186039");
    assert_eq!(data["recordedSessionUsage"]["estimatedTotalTokens"],"25");
    assert_eq!(data["recordedSessionUsage"]["coverage"],json!({"sessions":2,"baselineEntries":2,"deltaEntries":2,"duplicateEntries":2}));
    let rpc=tool(&app,"getTaskUsage",json!({"params":{"taskId":id(&task)},"query":{"limit":1}})).await;
    assert_eq!(rpc["structuredContent"]["data"],data);
}
