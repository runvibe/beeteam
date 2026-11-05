mod support;
use axum::Router;
use serde_json::{json, Value};
use support::*;

async fn setup() -> (Router, Value, Vec<Value>) {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Parent link worker"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"Parent link team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let mut boards = vec![];
    for name in ["Source", "Destination"] {
        boards.push(
            ok(
                &app,
                "POST",
                "/api/v2/boards",
                json!({"name":name,"teamId":id(&team)}),
                None,
            )
            .await,
        );
    }
    (app, agent, boards)
}
async fn task(
    app: &Router,
    agent: &Value,
    board: &Value,
    title: &str,
    parent: Option<&Value>,
) -> Value {
    let created = ok(app,"POST",&format!("/api/v2/boards/{}/tasks",id(board)),json!({"title":title,"description":"Keep authored text","specification":"# Original\nrequirements","workScope":test_project_scope(),"authorAgentId":id(agent),"executorAgentId":id(agent),"parentId":parent.map(|p|id(p)),"coordinationContext":manual()}),parent.and_then(ver)).await;
    get(app, &path(&created)).await
}
fn path(task: &Value) -> String {
    format!("/api/v2/tasks/{}", id(task))
}
fn link_body(parent: &Value) -> Value {
    json!({"parentId":id(parent),"parentVersion":parent["version"],"coordinationContext":manual()})
}
fn assert_task_snapshot(actual: Value, expected: &Value) {
    // PostgreSQL stores row timestamps at microsecond precision; immediate
    // mutation/replay responses retain the original nanosecond timestamp.
    let mut actual = actual;
    let mut expected = expected.clone();
    for field in ["createdAt", "updatedAt"] {
        let a = chrono::DateTime::parse_from_rfc3339(actual[field].as_str().unwrap()).unwrap();
        let b = chrono::DateTime::parse_from_rfc3339(expected[field].as_str().unwrap()).unwrap();
        assert_eq!(a.timestamp_micros(), b.timestamp_micros(), "{field}");
        actual[field] = Value::Null;
        expected[field] = Value::Null;
    }
    assert_eq!(actual, expected);
}

#[tokio::test]
async fn links_existing_subtree_without_recreating_content_or_history() {
    let (app, agent, boards) = setup().await;
    let root = task(&app, &agent, &boards[0], "Existing root", None).await;
    let child = task(&app, &agent, &boards[0], "Existing child", Some(&root)).await;
    let parent = task(&app, &agent, &boards[1], "Newer destination root", None).await;
    let root = get(&app, &path(&root)).await;
    ok(
        &app,
        "POST",
        &format!("{}/plans", path(&root)),
        json!({"title":"Saved plan","content":"# Preserve\nall revisions"}),
        ver(&root),
    )
    .await;
    let root = get(&app, &path(&root)).await;
    ok(
        &app,
        "POST",
        &format!("{}/comments", path(&root)),
        json!({"body":"Original comment"}),
        ver(&root),
    )
    .await;
    let root = get(&app, &path(&root)).await;
    let plans = get(&app, &format!("{}/plans", path(&root))).await;
    let comments = get(&app, &format!("{}/comments", path(&root))).await;
    let history = get(&app, &format!("{}/timeline", path(&root))).await;
    let key = uuid::Uuid::new_v4();
    let body = link_body(&parent);
    let endpoint = format!("{}/parent/link", path(&root));
    let (status, linked) =
        request_key(&app, "POST", &endpoint, body.clone(), ver(&root), key).await;
    assert_eq!(status, 200, "{linked}");
    assert_eq!(linked["parentId"], parent["id"]);
    assert_eq!(linked["executionContext"]["rootTaskId"], parent["id"]);
    assert_eq!(linked["executionContext"]["originBoardId"], boards[1]["id"]);
    for field in [
        "id",
        "slug",
        "createdAt",
        "title",
        "description",
        "specification",
        "workScope",
        "statusId",
        "boardId",
        "executorAgentId",
        "authorAgentId",
        "autonomyMode",
        "currentSummary",
        "block",
        "progress",
        "latestExecutionSummaryId",
    ] {
        assert_eq!(linked[field], root[field], "{field}");
    }
    let child_after = get(&app, &path(&child)).await;
    assert_eq!(child_after["parentId"], root["id"]);
    assert_eq!(child_after["executionContext"], linked["executionContext"]);
    assert_eq!(
        child_after["version"],
        child["version"].as_i64().unwrap() + 1
    );
    assert_eq!(get(&app, &format!("{}/plans", path(&root))).await, plans);
    assert_eq!(
        get(&app, &format!("{}/comments", path(&root))).await,
        comments
    );
    let after = get(&app, &format!("{}/timeline", path(&root))).await;
    for event in history["items"].as_array().unwrap() {
        assert!(after["items"].as_array().unwrap().contains(event));
    }
    assert_eq!(
        after["total"].as_i64().unwrap(),
        history["total"].as_i64().unwrap() + 1
    );
    assert_eq!(
        request_key(&app, "POST", &endpoint, body, ver(&root), key).await,
        (200, linked.clone())
    );
    assert_task_snapshot(get(&app, &path(&root)).await, &linked);
    assert_eq!(
        get(&app, &format!("/api/v2/tasks?parentId={}", id(&parent))).await["items"][0]["id"],
        root["id"]
    );
}

#[tokio::test]
async fn conflicts_cycles_and_invalid_targets_leave_every_record_unchanged() {
    let (app, agent, boards) = setup().await;
    let root = task(&app, &agent, &boards[0], "Root", None).await;
    let child = task(&app, &agent, &boards[1], "Child", Some(&root)).await;
    let root = get(&app, &path(&root)).await;
    let parent = task(&app, &agent, &boards[1], "Parent", None).await;
    let endpoint = format!("{}/parent/link", path(&root));
    for target in [&root, &child] {
        let (status, error) = request(&app, "POST", &endpoint, link_body(target), ver(&root)).await;
        assert_eq!(status, 409, "{error}");
        assert_eq!(error["code"], "parent_cycle");
    }
    let mut stale_parent = link_body(&parent);
    stale_parent["parentVersion"] = json!(99);
    for (body, version, expected) in [
        (link_body(&parent), None, 428),
        (link_body(&parent), Some(99), 412),
        (stale_parent, ver(&root), 412),
    ] {
        assert_eq!(
            request(&app, "POST", &endpoint, body, version).await.0,
            expected
        );
    }
    let mut missing = link_body(&parent);
    missing["parentId"] = json!(uuid::Uuid::now_v7());
    assert_eq!(
        request(&app, "POST", &endpoint, missing, ver(&root))
            .await
            .0,
        404
    );
    let mut bypass = link_body(&parent);
    bypass["coordinationContext"] = automatic();
    assert_eq!(
        request(&app, "POST", &endpoint, bypass, ver(&root)).await.1["code"],
        "coordination_mode_mismatch"
    );
    assert_eq!(get(&app, &path(&root)).await, root);
    assert_eq!(get(&app, &path(&child)).await, child);
    assert_eq!(get(&app, &path(&parent)).await, parent);
    ok(
        &app,
        "PUT",
        &format!("{}/archive", path(&parent)),
        json!({"archived":true}),
        ver(&parent),
    )
    .await;
    let archived = get(&app, &path(&parent)).await;
    assert_eq!(
        request(&app, "POST", &endpoint, link_body(&archived), ver(&root))
            .await
            .1["code"],
        "archived_resource"
    );
    assert_eq!(get(&app, &path(&root)).await, root);
}

#[tokio::test]
async fn reparent_requires_both_parent_versions_and_noop_does_not_append_history() {
    let (app, agent, boards) = setup().await;
    let first = task(&app, &agent, &boards[0], "First", None).await;
    let child = task(&app, &agent, &boards[0], "Child", Some(&first)).await;
    let first = get(&app, &path(&first)).await;
    let second = task(&app, &agent, &boards[1], "Second", None).await;
    let endpoint = format!("{}/parent/link", path(&child));
    assert_eq!(
        request(&app, "POST", &endpoint, link_body(&second), ver(&child))
            .await
            .0,
        428
    );
    let mut body = link_body(&second);
    body["previousParentVersion"] = first["version"].clone();
    let linked = ok(&app, "POST", &endpoint, body, ver(&child)).await;
    assert_eq!(get(&app, &path(&first)).await["childSummary"]["total"], 0);
    let second = get(&app, &path(&second)).await;
    assert_eq!(second["childSummary"]["total"], 1);
    let history = get(&app, &format!("{}/timeline", path(&child))).await;
    let mut noop = link_body(&second);
    noop["previousParentVersion"] = second["version"].clone();
    assert_task_snapshot(
        ok(&app, "POST", &endpoint, noop, ver(&linked)).await,
        &linked,
    );
    assert_eq!(
        get(&app, &format!("{}/timeline", path(&child))).await,
        history
    );
}

#[tokio::test]
async fn concurrent_links_cannot_overwrite_each_other_or_form_a_cycle() {
    let (app, agent, boards) = setup().await;
    let a = task(&app, &agent, &boards[0], "A", None).await;
    let b = task(&app, &agent, &boards[1], "B", None).await;
    let a_path = format!("{}/parent/link", path(&a));
    let b_path = format!("{}/parent/link", path(&b));
    let (left, right) = tokio::join!(
        request(&app, "POST", &a_path, link_body(&b), ver(&a)),
        request(&app, "POST", &b_path, link_body(&a), ver(&b))
    );
    let mut statuses = [left.0, right.0];
    statuses.sort();
    assert_eq!(statuses, [200, 412], "{left:?} {right:?}");
    let a = get(&app, &path(&a)).await;
    let b = get(&app, &path(&b)).await;
    assert!(a["parentId"].is_null() || b["parentId"].is_null());
    assert_eq!(
        a["executionContext"]["rootTaskId"],
        b["executionContext"]["rootTaskId"]
    );
}

#[tokio::test]
async fn manual_descendants_cannot_gain_automatic_origin_without_approval() {
    let (app, agent, boards) = setup().await;
    let root = task(&app, &agent, &boards[0], "Automatic root", None).await;
    let child = task(&app, &agent, &boards[0], "Manual child", Some(&root)).await;
    let parent = task(&app, &agent, &boards[1], "Automatic destination", None).await;
    // Source standard means each node keeps its own mode; destination automatic
    // must not erase the child's pre-change need for approval.
    ok(
        &app,
        "PATCH",
        &format!("/api/v2/boards/{}", id(&boards[0])),
        json!({"autonomyMode":"standard"}),
        ver(&boards[0]),
    )
    .await;
    ok(
        &app,
        "PATCH",
        &format!("/api/v2/boards/{}", id(&boards[1])),
        json!({"autonomyMode":"automatic"}),
        ver(&boards[1]),
    )
    .await;
    let root = get(&app, &path(&root)).await;
    let root = ok(
        &app,
        "PATCH",
        &path(&root),
        json!({"autonomyMode":"automatic"}),
        ver(&root),
    )
    .await;
    let parent = get(&app, &path(&parent)).await;
    let endpoint = format!("{}/parent/link", path(&root));
    let mut bypass = link_body(&parent);
    bypass["coordinationContext"] = automatic();
    assert_eq!(
        request(&app, "POST", &endpoint, bypass, ver(&root)).await.1["code"],
        "coordination_mode_mismatch"
    );
    assert_task_snapshot(get(&app, &path(&root)).await, &root);
    let linked = ok(&app, "POST", &endpoint, link_body(&parent), ver(&root)).await;
    assert_eq!(linked["executionContext"]["effectiveMode"], "automatic");
    let child = get(&app, &path(&child)).await;
    assert_eq!(child["autonomyMode"], "manual");
    assert_eq!(child["executionContext"]["effectiveMode"], "automatic");
}

#[tokio::test]
async fn automatic_link_into_standard_origin_preserves_each_nodes_mode() {
    let (app, agent, boards) = setup().await;
    let root = task(&app, &agent, &boards[0], "Root", None).await;
    let child = task(&app, &agent, &boards[0], "Child", Some(&root)).await;
    let parent = task(&app, &agent, &boards[1], "Parent", None).await;
    ok(
        &app,
        "PATCH",
        &format!("/api/v2/boards/{}", id(&boards[0])),
        json!({"autonomyMode":"automatic"}),
        ver(&boards[0]),
    )
    .await;
    ok(
        &app,
        "PATCH",
        &format!("/api/v2/boards/{}", id(&boards[1])),
        json!({"autonomyMode":"standard"}),
        ver(&boards[1]),
    )
    .await;
    let mut updated = vec![];
    for task in [&root, &child, &parent] {
        let task = get(&app, &path(task)).await;
        updated.push(
            ok(
                &app,
                "PATCH",
                &path(&task),
                json!({"autonomyMode":"automatic"}),
                ver(&task),
            )
            .await,
        );
    }
    let mut body = link_body(&updated[2]);
    body["coordinationContext"] = automatic();
    let linked = ok(
        &app,
        "POST",
        &format!("{}/parent/link", path(&root)),
        body,
        ver(&updated[0]),
    )
    .await;
    assert_eq!(linked["executionContext"]["effectiveMode"], "automatic");
    let child = get(&app, &path(&child)).await;
    assert_eq!(child["executionContext"]["originBoardMode"], "standard");
    assert_eq!(child["executionContext"]["effectiveMode"], "automatic");
}

#[tokio::test]
async fn archived_descendant_prevents_partial_reparenting() {
    let (app, agent, boards) = setup().await;
    let root = task(&app, &agent, &boards[0], "Root", None).await;
    let child = task(&app, &agent, &boards[0], "Child", Some(&root)).await;
    let parent = task(&app, &agent, &boards[1], "Parent", None).await;
    ok(
        &app,
        "PUT",
        &format!("{}/archive", path(&child)),
        json!({"archived":true}),
        ver(&child),
    )
    .await;
    let root = get(&app, &path(&root)).await;
    let history = get(&app, &format!("{}/timeline", path(&root))).await;
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{}/parent/link", path(&root)),
            link_body(&parent),
            ver(&root)
        )
        .await
        .1["code"],
        "archived_resource"
    );
    assert_eq!(get(&app, &path(&root)).await, root);
    assert_eq!(get(&app, &path(&parent)).await, parent);
    assert_eq!(
        get(&app, &format!("{}/timeline", path(&root))).await,
        history
    );
}

fn summary_body(task: &Value) -> Value {
    let mut usage = session_usage(task["executorAgentId"].as_str().unwrap());
    usage["entries"][0]["actorRole"] = json!("worker");
    json!({"commitReport":{"hasCommits":false,"commits":[]},"usageReport":usage,"summary":"# Historical context","currentSummary":"Preserved synthesis","statusId":task["statusId"],"outcome":"progress","deliverables":[],"pending":[],"executionContext":{"rootTaskId":task["executionContext"]["rootTaskId"],"originBoardId":task["executionContext"]["originBoardId"]}})
}

#[tokio::test]
async fn summaries_keep_original_context_and_open_descendant_intervals_prevent_link() {
    let (app, agent, boards) = setup().await;
    let root = task(&app, &agent, &boards[0], "Root", None).await;
    let child = task(&app, &agent, &boards[0], "Child", Some(&root)).await;
    let parent = task(&app, &agent, &boards[1], "Parent", None).await;
    let mut start = summary_body(&child);
    let observation = &start["usageReport"]["entries"][0];
    start["executionTracking"] = json!({"action":"start","counterMode":"global","coverageRootSessionId":observation["sessionId"],"evidenceIds":[observation["evidenceId"]]});
    let started = ok(
        &app,
        "POST",
        &format!("{}/execution-summaries", path(&child)),
        start.clone(),
        ver(&child),
    )
    .await;
    let child = started["task"].clone();
    let root = get(&app, &path(&root)).await;
    let endpoint = format!("{}/parent/link", path(&root));
    assert_eq!(
        request(&app, "POST", &endpoint, link_body(&parent), ver(&root))
            .await
            .1["code"],
        "active_execution_interval"
    );
    assert_eq!(get(&app, &path(&root)).await, root);
    let tr = &started["executionSummary"]["executionTracking"];
    start["executionTracking"] = json!({"action":"pause","executionId":tr["executionId"],"intervalId":tr["intervalId"],"evidenceIds":[start["usageReport"]["entries"][0]["evidenceId"]],"reason":"Change hierarchy"});
    ok(
        &app,
        "POST",
        &format!("{}/execution-summaries", path(&child)),
        start,
        ver(&child),
    )
    .await;
    let before = get(&app, &format!("{}/execution-summaries", path(&child))).await;
    ok(&app, "POST", &endpoint, link_body(&parent), ver(&root)).await;
    assert_eq!(
        get(&app, &format!("{}/execution-summaries", path(&child))).await,
        before
    );
    let child = get(&app, &path(&child)).await;
    assert_eq!(child["currentSummary"], "Preserved synthesis");
    let mut stale = summary_body(&child);
    stale["executionContext"] = json!({"rootTaskId":root["id"],"originBoardId":boards[0]["id"]});
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{}/execution-summaries", path(&child)),
            stale,
            ver(&child)
        )
        .await
        .1["code"],
        "execution_context_mismatch"
    );
}

#[cfg(feature = "mcp")]
async fn mcp(app: &Router, task: &Value, body: Value, key: uuid::Uuid) -> Value {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/mcp")
        .header("host","127.0.0.1").header("content-type","application/json")
        .header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"linkTaskToParent","arguments":{"params":{"taskId":id(task)},"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":key,"body":body}}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap()
}
#[cfg(feature = "mcp")]
#[tokio::test]
async fn mcp_and_http_share_replays_validation_and_effects() {
    let (app, agent, boards) = setup().await;
    let child = task(&app, &agent, &boards[0], "Child", None).await;
    let parent = task(&app, &agent, &boards[1], "Parent", None).await;
    let body = link_body(&parent);
    let key = uuid::Uuid::new_v4();
    let rpc = mcp(&app, &child, body.clone(), key).await;
    assert_ne!(rpc["result"]["isError"], true, "{rpc}");
    let linked = &rpc["result"]["structuredContent"]["data"];
    assert_eq!(linked["parentId"], parent["id"], "{rpc}");
    let endpoint = format!("{}/parent/link", path(&child));
    assert_eq!(
        request_key(&app, "POST", &endpoint, body.clone(), ver(&child), key).await,
        (200, linked.clone())
    );
    let mut changed = body;
    changed["parentVersion"] = json!(99);
    assert_eq!(
        request_key(&app, "POST", &endpoint, changed, ver(&child), key)
            .await
            .1["code"],
        "idempotency_conflict"
    );
    let now = get(&app, &path(&child)).await;
    let mut invalid = link_body(&now);
    invalid["previousParentVersion"] = json!(2);
    let rpc = mcp(&app, &now, invalid, uuid::Uuid::new_v4()).await;
    assert_eq!(rpc["result"]["isError"], true, "{rpc}");
    assert_eq!(rpc["result"]["structuredContent"]["code"], "parent_cycle");
}
