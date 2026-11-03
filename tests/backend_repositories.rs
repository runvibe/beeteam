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

fn scope() -> Value {
    json!({"status":"identified","projects":[{"key":"app","name":"Application","rootPath":"C:/projects/app"},{"key":"worktree","name":"Worktree","rootPath":"/worktrees/review"}],"repositories":[{"key":"app","name":"Original repository","remoteUrl":"git@git.example:group/app.git","webUrl":"https://git.example/group/app","provider":"gitlab","projectKeys":["app","worktree"]},{"key":"local","name":"Local repo","remoteUrl":null,"webUrl":null,"provider":"other","projectKeys":["app"]}]})
}
fn execution(task: &Value, board: &Value) -> Value {
    json!({"commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(task["executorAgentId"].as_str().unwrap()),"summary":"## Historical Markdown","currentSummary":"Current synthesis","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(task),"originBoardId":id(board)}})
}
fn reference() -> Value {
    json!({"repositoryKey":"app","branch":{"state":"named","name":"codex/work"},"hash":"a".repeat(40),"availability":"published","remoteVerifiedAt":"2026-11-03T00:00:00Z","commitUrl":format!("https://git.example/group/app/-/commit/{}","a".repeat(40))})
}
async fn rpc(app: &Router, name: &str, args: Value) -> Value {
    let r=app.clone().oneshot(Request::post("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":args}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice::<Value>(&r.into_body().collect().await.unwrap().to_bytes()).unwrap()
        ["result"]
        .clone()
}
#[tokio::test]
async fn scope_is_optional_atomic_and_independent_from_markdown() {
    let (app, agent, board, task) = setup().await;
    assert!(task.get("workScope").is_none());
    let path = format!("/api/v1/tasks/{}", id(&task));
    let task = ok(
        &app,
        "PATCH",
        &path,
        json!({"workScope":scope(),"specification":"# Literal specification"}),
        ver(&task),
    )
    .await;
    assert_eq!(task["workScope"], scope());
    let stored_task = get(&app, &path).await;
    for invalid in [
        json!({"status":"not_applicable","projects":scope()["projects"],"repositories":[]}),
        json!({"status":"identified","projects":[],"repositories":[]}),
    ] {
        assert_eq!(
            request(
                &app,
                "PATCH",
                &path,
                json!({"workScope":invalid,"specification":"Should rollback"}),
                ver(&task)
            )
            .await
            .0,
            400
        );
        assert_eq!(get(&app, &path).await, stored_task);
    }
    for (kind, field, value) in [
        ("projects", "rootPath", json!("relative/path")),
        ("repositories", "projectKeys", json!(["missing"])),
        (
            "repositories",
            "remoteUrl",
            json!("https://secret@host/repo"),
        ),
        ("repositories", "webUrl", json!("javascript:alert(1)")),
    ] {
        let mut invalid = scope();
        invalid[kind][0][field] = value;
        assert_eq!(
            request(
                &app,
                "PATCH",
                &path,
                json!({"workScope":invalid}),
                ver(&task)
            )
            .await
            .0,
            400
        );
        assert_eq!(get(&app, &path).await, stored_task);
    }
    let created=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Structured","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual(),"workScope":scope()}),None).await;
    assert_eq!(created["workScope"], scope());
    let updated = ok(
        &app,
        "PATCH",
        &path,
        json!({"workScope":{"status":"not_applicable","projects":[],"repositories":[]}}),
        ver(&task),
    )
    .await;
    assert_eq!(updated["specification"], task["specification"]);
    assert_eq!(updated["currentSummary"], task["currentSummary"]);
}
#[tokio::test]
async fn invalid_reports_have_http_mcp_parity_and_rollback_compound_writes() {
    let (app, _, board, task) = setup().await;
    let path = format!("/api/v1/tasks/{}", id(&task));
    let task = ok(
        &app,
        "PATCH",
        &path,
        json!({"workScope":scope()}),
        ver(&task),
    )
    .await;
    let route = format!("{path}/execution-summaries");
    let timeline = get(&app, &format!("{path}/timeline")).await;
    let stored_task = get(&app, &path).await;
    let mut invalids = vec![
        Value::Null,
        json!({"hasCommits":true,"commits":[]}),
        json!({"hasCommits":false,"commits":[reference()]}),
    ];
    for (field, value) in [
        ("repositoryKey", json!("unknown")),
        ("hash", json!("abc123")),
        ("branch", json!({"state":"detached","name":"main"})),
        ("branch", json!({"state":"named","name":" "})),
        ("availability", json!("local")),
        ("remoteVerifiedAt", Value::Null),
        ("commitUrl", json!("javascript:alert(1)")),
        (
            "commitUrl",
            json!(format!(
                "https://evil.example/group/app/-/commit/{}",
                "a".repeat(40)
            )),
        ),
    ] {
        let mut c = reference();
        c[field] = value;
        invalids.push(json!({"hasCommits":true,"commits":[c]}));
    }
    invalids.push(json!({"hasCommits":true,"commits":[reference(),reference()]}));
    for report in invalids {
        let mut body = execution(&task, &board);
        if report.is_null() {
            body.as_object_mut().unwrap().remove("commitReport");
        } else {
            body["commitReport"] = report;
        }
        assert_eq!(
            request(&app, "POST", &route, body.clone(), ver(&task))
                .await
                .0,
            400,
            "{body}"
        );
        let direct=rpc(&app,"createExecutionSummary",json!({"params":{"taskId":id(&task)},"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":body})).await;
        assert_eq!(direct["isError"], true, "{direct}");
        let close=rpc(&app,"close_activity",json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must rollback","block":{"blocked":true,"reason":"Must rollback"},"execution":body})).await;
        assert_eq!(close["isError"], true, "{close}");
        assert_eq!(get(&app, &path).await, stored_task);
        assert_eq!(get(&app, &format!("{path}/timeline")).await, timeline);
        assert_eq!(get(&app, &route).await["total"], 0);
        assert_eq!(get(&app, &format!("{path}/comments")).await["total"], 0);
    }
}
#[tokio::test]
async fn references_snapshot_multiple_repos_branches_and_survive_scope_edits_and_replay() {
    let (app, _, board, task) = setup().await;
    let path = format!("/api/v1/tasks/{}", id(&task));
    let task = ok(
        &app,
        "PATCH",
        &path,
        json!({"workScope":scope()}),
        ver(&task),
    )
    .await;
    let route = format!("{path}/execution-summaries");
    let key = uuid::Uuid::new_v4();
    let mut detached = reference();
    detached["repositoryKey"] = json!("local");
    detached["hash"] = json!("B".repeat(64));
    detached["branch"] = json!({"state":"detached","name":null});
    detached["availability"] = json!("local");
    detached["remoteVerifiedAt"] = Value::Null;
    detached["commitUrl"] = Value::Null;
    let mut unknown = detached.clone();
    unknown["hash"] = json!("c".repeat(40));
    unknown["branch"] = json!({"state":"unknown","name":null});
    unknown["availability"] = json!("unknown");
    let mut body = execution(&task, &board);
    body["commitReport"] = json!({"hasCommits":true,"commits":[reference(),detached,unknown]});
    let (status, result) = request_key(&app, "POST", &route, body.clone(), ver(&task), key).await;
    assert_eq!(status, 201, "{result}");
    let summary = &result["executionSummary"];
    assert_eq!(
        summary["commitReport"]["commits"][0]["repository"],
        scope()["repositories"][0]
    );
    assert_eq!(
        summary["commitReport"]["commits"][1]["hash"],
        "b".repeat(64)
    );
    let stored_summary = get(&app, &route).await["items"][0].clone();
    let mut changed = scope();
    changed["repositories"][0]["name"] = json!("Renamed");
    changed["repositories"][0]["webUrl"] = json!("https://other.example/new");
    let task2 = ok(
        &app,
        "PATCH",
        &path,
        json!({"workScope":changed}),
        ver(&result["task"]),
    )
    .await;
    assert_eq!(
        request_key(&app, "POST", &route, body, ver(&task), key)
            .await
            .1,
        result
    );
    assert_eq!(get(&app, &route).await["items"][0], stored_summary);
    let out=rpc(&app,"close_activity",json!({"taskId":id(&task),"actor":{"kind":"human"},"expectedVersion":task2["version"],"idempotencyKey":uuid::Uuid::new_v4(),"execution":execution(&task2,&board)})).await;
    assert_eq!(out["isError"], false, "{out}");
    assert_eq!(get(&app, &route).await["total"], 2);
}
