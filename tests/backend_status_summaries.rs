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
        json!({"name":"Status fixture"}),
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
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Status task","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    (app, agent, board, task)
}
fn execution(task: &Value, board: &Value) -> Value {
    json!({"usageReport":session_usage(task["executorAgentId"].as_str().unwrap()),"summary":"Historical Markdown","currentSummary":"Current synthesis","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(task),"originBoardId":id(board)}})
}

fn args(task: &Value, body: Value) -> Value {
    json!({"params":{"taskId":id(task)},"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":body})
}

#[tokio::test]
async fn status_changes_require_summary_in_http_and_mcp_without_side_effects() {
    let (app, _, board, task) = setup().await;
    let path = format!("/api/v1/tasks/{}", id(&task));
    let history = get(&app, &format!("{path}/timeline")).await;
    for target in board["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|s| s["id"] != task["statusId"])
    {
        for synthesis in [Some(json!("A synthesis is not an execution summary")), None] {
            let mut body = json!({"statusId":target["id"],"beforeTaskId":null});
            if let Some(synthesis) = synthesis {
                body["currentSummary"] = synthesis;
            }
            let (status, error) = request(
                &app,
                "PUT",
                &format!("{path}/position"),
                body.clone(),
                ver(&task),
            )
            .await;
            assert_eq!(status, 409, "{error}");
            assert_eq!(error["code"], "summary_required");
            let rpc = tool(&app, "moveTask", args(&task, body)).await;
            assert_eq!(rpc["isError"], true, "{rpc}");
            assert!(rpc.to_string().contains("summary_required"));
        }
    }
    // PATCH has no status field, even when it equals the current value.
    for target in board["statuses"].as_array().unwrap() {
        let body = json!({"statusId":target["id"],"currentSummary":"Not an execution summary"});
        let (status, error) = request(&app, "PATCH", &path, body.clone(), ver(&task)).await;
        assert_eq!(status, 400, "{error}");
        assert_eq!(error["code"], "invalid_request");
        assert_eq!(
            tool(&app, "updateTask", args(&task, body)).await["isError"],
            true
        );
    }
    let rpc=tool(&app,"record_progress",json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"statusId":board["statuses"][1]["id"],"currentSummary":"Cannot bypass"})).await;
    assert_eq!(rpc["isError"], true, "{rpc}");
    assert_eq!(get(&app, &path).await, task);
    assert_eq!(get(&app, &format!("{path}/timeline")).await, history);
    assert_eq!(
        get(&app, &format!("{path}/execution-summaries")).await["total"],
        0
    );
}

#[tokio::test]
async fn initial_status_reordering_and_progress_remain_independent() {
    let (app, agent, board, first) = setup().await;
    let next = board["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] != first["statusId"] && s["isDone"] == false)
        .unwrap();
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Explicit initial status","statusId":next["id"],"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    assert_eq!(task["statusId"], next["id"]);
    let path = format!("/api/v1/tasks/{}", id(&task));
    let task = ok(
        &app,
        "PUT",
        &format!("{path}/position"),
        json!({"statusId":task["statusId"],"beforeTaskId":null}),
        ver(&task),
    )
    .await;
    let task=ok(&app,"PATCH",&path,json!({"progress":{"percent":25,"note":"Independent progress"},"currentSummary":"Progress only"}),ver(&task)).await;
    assert_eq!(task["statusId"], next["id"]);
    assert_eq!(task["progress"]["percent"], 25);
    assert_eq!(
        get(&app, &format!("{path}/execution-summaries")).await["total"],
        0
    );
    let done = board["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["isDone"] == true)
        .unwrap();
    let mut body = execution(&task, &board);
    body["statusId"] = done["id"].clone();
    body["outcome"] = json!("completed");
    let result = ok(
        &app,
        "POST",
        &format!("{path}/execution-summaries"),
        body,
        ver(&task),
    )
    .await;
    let final_task = &result["task"];
    let reordered = tool(
        &app,
        "moveTask",
        args(
            final_task,
            json!({"statusId":done["id"],"beforeTaskId":null}),
        ),
    )
    .await;
    assert_eq!(reordered["isError"], false, "{reordered}");
    assert_eq!(
        get(&app, &format!("{path}/execution-summaries")).await["total"],
        1
    );
}

#[tokio::test]
async fn summary_transition_snapshot_and_replay_are_atomic_and_historical() {
    let (app, _, board, task) = setup().await;
    let next = board["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] != task["statusId"] && s["isDone"] == false)
        .unwrap();
    let path = format!("/api/v1/tasks/{}", id(&task));
    let route = format!("{path}/execution-summaries");
    let mut body = execution(&task, &board);
    body["statusId"] = next["id"].clone();
    let key = uuid::Uuid::new_v4();
    let (status, result) = request_key(&app, "POST", &route, body.clone(), ver(&task), key).await;
    assert_eq!(status, 201, "{result}");
    let snapshot = json!({"id":next["id"],"name":next["name"],"isDone":false});
    assert_eq!(result["task"]["statusId"], next["id"]);
    assert_eq!(result["executionSummary"]["statusObserved"], snapshot);
    let mut same = execution(&result["task"], &board);
    same["statusId"] = next["id"].clone();
    let same_result = tool(&app, "createExecutionSummary", args(&result["task"], same)).await;
    assert_eq!(same_result["isError"], false, "{same_result}");
    assert_eq!(
        same_result["structuredContent"]["data"]["executionSummary"]["statusObserved"],
        snapshot
    );
    ok(
        &app,
        "PATCH",
        &format!("/api/v1/boards/{}/statuses/{}", id(&board), id(next)),
        json!({"name":"Renamed later"}),
        ver(next),
    )
    .await;
    let live = get(&app, &path).await;
    let mut back = execution(&live, &board);
    back["statusId"] = task["statusId"].clone();
    ok(&app, "POST", &route, back, ver(&live)).await;
    let revised = ok(
        &app,
        "POST",
        &format!(
            "{route}/{}/usage-revisions",
            id(&result["executionSummary"])
        ),
        unavailable_usage(),
        ver(&result["executionSummary"]),
    )
    .await;
    assert_eq!(revised["statusObserved"], snapshot);
    assert_eq!(revised["usageReport"]["statusObserved"], snapshot);
    let before = get(&app, &path).await;
    let history = get(&app, &format!("{path}/timeline")).await;
    let usage = get(&app, &format!("{path}/usage")).await;
    let point = usage["timeline"]["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["summaryId"] == result["executionSummary"]["id"])
        .unwrap();
    assert_eq!(point["statusObserved"], snapshot);
    let (status, replayed) = request_key(&app, "POST", &route, body.clone(), ver(&task), key).await;
    assert_eq!(status, 201);
    assert_eq!(replayed, result);
    let mut replay_args = args(&task, body);
    replay_args["idempotencyKey"] = json!(key);
    assert_eq!(
        tool(&app, "createExecutionSummary", replay_args).await["structuredContent"]["data"],
        result
    );
    assert_eq!(get(&app, &path).await, before);
    assert_eq!(get(&app, &format!("{path}/timeline")).await, history);
}

#[tokio::test]
async fn close_activity_rolls_back_failures_and_replays_valid_transition() {
    let (app, _, board, task) = setup().await;
    let next = board["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] != task["statusId"] && s["isDone"] == false)
        .unwrap();
    let path = format!("/api/v1/tasks/{}", id(&task));
    let mut body = execution(&task, &board);
    body["statusId"] = next["id"].clone();
    let close = json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"block":{"blocked":true,"reason":"Dependency"},"comment":"Atomic comment","execution":body});
    let history = get(&app, &format!("{path}/timeline")).await;
    let mut missing = close.clone();
    missing.as_object_mut().unwrap().remove("execution");
    assert_eq!(tool(&app, "close_activity", missing).await["isError"], true);
    let mut invalid = close.clone();
    invalid["execution"]["executionContext"]["rootTaskId"] = json!(uuid::Uuid::now_v7());
    let failed = tool(&app, "close_activity", invalid).await;
    assert_eq!(failed["isError"], true, "{failed}");
    assert_eq!(get(&app, &path).await, task);
    assert_eq!(get(&app, &format!("{path}/timeline")).await, history);
    assert_eq!(get(&app, &format!("{path}/comments")).await["total"], 0);
    assert_eq!(
        get(&app, &format!("{path}/execution-summaries")).await["total"],
        0
    );
    let result = tool(&app, "close_activity", close.clone()).await;
    assert_eq!(result["isError"], false, "{result}");
    assert_eq!(result["structuredContent"]["task"]["statusId"], next["id"]);
    let replay = tool(&app, "close_activity", close).await;
    assert_eq!(replay, result);
    assert_eq!(
        get(&app, &format!("{path}/execution-summaries")).await["total"],
        1
    );
    assert_eq!(get(&app, &format!("{path}/comments")).await["total"], 1);
}
async fn tool(app: &Router, name: &str, args: Value) -> Value {
    let r=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice::<Value>(&r.into_body().collect().await.unwrap().to_bytes()).unwrap()
        ["result"]
        .clone()
}
