mod support;
use serde_json::json;
use support::*;
#[tokio::test]
async fn create_agent_has_v7_identity_and_strict_input() {
    let app = app().await;
    let (status, agent) = request(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Test agent"}),
        None,
    )
    .await;
    assert_eq!(status, 201, "{agent}");
    assert_eq!(
        uuid::Uuid::parse_str(agent["id"].as_str().unwrap())
            .unwrap()
            .get_version_num(),
        7
    );
    assert!(agent["deletedAt"].is_null());
    assert_eq!(agent["slug"], "test-agent");
    let (status, _) = request(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Bad","skills":[]}),
        None,
    )
    .await;
    assert_eq!(status, 400);
}

#[tokio::test]
async fn full_http_domain_cross_board_recursion_transfer_and_history() {
    let app = app().await;
    let a = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Leader A"}),
        None,
    )
    .await;
    let b = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Leader B"}),
        None,
    )
    .await;
    let c = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Worker 100%_literal","contextSummary":"Private worker context"}),
        None,
    )
    .await;
    let t1=ok(&app,"POST","/api/v1/teams",json!({"name":"Team A","leaderId":id(&a),"collaboratorIds":[id(&c)],"coordinationContext":manual()}),None).await;
    let t2 = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Team B","leaderId":id(&b),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Origin","teamId":id(&t1),"autonomyMode":"automatic"}),
        None,
    )
    .await;
    let dest = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Destination","teamId":id(&t2),"autonomyMode":"manual"}),
        None,
    )
    .await;
    let root=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Root","authorAgentId":id(&a),"executorAgentId":id(&c),"coordinationContext":automatic()}),None).await;
    let child=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&dest)),json!({"title":"Child","parentId":id(&root),"authorAgentId":id(&b),"executorAgentId":id(&a),"autonomyMode":"manual","coordinationContext":automatic()}),ver(&root)).await;
    let grandchild=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Grandchild","parentId":id(&child),"authorAgentId":id(&a),"executorAgentId":id(&b),"coordinationContext":automatic()}),ver(&child)).await;
    assert_eq!(grandchild["executionContext"]["rootTaskId"], root["id"]);
    assert_eq!(grandchild["executionContext"]["originBoardId"], board["id"]);
    assert_eq!(grandchild["executionContext"]["effectiveMode"], "automatic");
    let children = get(&app, &format!("/api/v1/tasks?parentId={}", id(&root))).await;
    assert_eq!(children["total"], 1);
    assert_eq!(children["items"][0]["id"], child["id"]);
    let mut root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    let plan = ok(
        &app,
        "POST",
        &format!("/api/v1/tasks/{}/plans", id(&root)),
        json!({"title":"Plan","content":"Initial"}),
        ver(&root),
    )
    .await;
    root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    ok(
        &app,
        "POST",
        &format!(
            "/api/v1/tasks/{}/plans/{}/revisions",
            id(&root),
            plan["planId"].as_str().unwrap()
        ),
        json!({"baseRevision":1,"content":"Updated","changeSummary":"More detail"}),
        ver(&root),
    )
    .await;
    let plans = get(&app, &format!("/api/v1/tasks/{}/plans", id(&root))).await;
    assert_eq!(plans["total"], 1);
    assert_eq!(plans["items"][0]["revision"], 2);
    let revisions = get(
        &app,
        &format!(
            "/api/v1/tasks/{}/plans/{}/revisions",
            id(&root),
            plan["planId"].as_str().unwrap()
        ),
    )
    .await;
    assert_eq!(revisions["total"], 2);
    root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    ok(
        &app,
        "POST",
        &format!("/api/v1/tasks/{}/comments", id(&root)),
        json!({"body":"A comment"}),
        ver(&root),
    )
    .await;
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(&root))).await["total"],
        1
    );
    root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    root = ok(
        &app,
        "PUT",
        &format!("/api/v1/tasks/{}/block", id(&root)),
        json!({"blocked":true,"reason":"Dependency"}),
        ver(&root),
    )
    .await;
    let status = root["statusId"].clone();
    let execution = json!({"currentSummary":"Investigation complete; blocked on dependency; next resolve it.","usageReport":session_usage(root["executorAgentId"].as_str().unwrap()),"summary":"Blocked on dependency","outcome":"blocked","statusId":status,"deliverables":[],"pending":["Resolve dependency"],"executionContext":{"rootTaskId":root["id"],"originBoardId":board["id"]}});
    let result = ok(
        &app,
        "POST",
        &format!("/api/v1/tasks/{}/execution-summaries", id(&root)),
        execution,
        ver(&root),
    )
    .await;
    root = result["task"].clone();
    root = ok(
        &app,
        "PUT",
        &format!("/api/v1/tasks/{}/block", id(&root)),
        json!({"blocked":false,"reason":null}),
        ver(&root),
    )
    .await;
    let done = board["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["isDone"] == true)
        .unwrap();
    assert_eq!(
        request(
            &app,
            "PUT",
            &format!("/api/v1/tasks/{}/position", id(&root)),
            json!({"statusId":id(done),"beforeTaskId":null,"currentSummary":"Ready for completion"}),
            ver(&root)
        )
        .await
        .0,
        409
    );
    let result=ok(&app,"POST",&format!("/api/v1/tasks/{}/execution-summaries",id(&root)),json!({"currentSummary":"Work and verification complete; no remaining work.","usageReport":session_usage(root["executorAgentId"].as_str().unwrap()),"summary":"Completed","outcome":"completed","statusId":id(done),"deliverables":[],"pending":[],"executionContext":{"rootTaskId":root["id"],"originBoardId":board["id"]}}),ver(&root)).await;
    assert_eq!(result["task"]["progress"]["percent"], 100);
    let child_now = get(&app, &format!("/api/v1/tasks/{}", id(&child))).await;
    assert_eq!(child_now["progress"]["percent"], 0);
    let board = ok(
        &app,
        "PATCH",
        &format!("/api/v1/boards/{}", id(&board)),
        json!({"teamId":id(&t2),"autonomyMode":"standard"}),
        ver(&board),
    )
    .await;
    assert_eq!(board["lastManagementChange"]["previousTeamId"], t1["id"]);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&child))).await["executionContext"]
            ["effectiveMode"],
        "manual"
    );
    let t1 = ok(
        &app,
        "PUT",
        &format!("/api/v1/teams/{}/archive", id(&t1)),
        json!({"archived":true}),
        ver(&t1),
    )
    .await;
    ok(&app,"POST","/api/v1/team-composition-changes",json!({"teams":[{"teamId":id(&t1),"expectedVersion":t1["version"],"leaderId":id(&a),"collaboratorIds":[]},{"teamId":id(&t2),"expectedVersion":t2["version"],"leaderId":id(&b),"collaboratorIds":[id(&c)]}],"coordinationContext":manual()}),None).await;
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&root))).await["executorAgentId"],
        c["id"]
    );
    assert_eq!(
        get(&app, &format!("/api/v1/agents/{}", id(&c))).await["bindings"]["collaboratorTeamId"],
        t2["id"]
    );
    let mut root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    root = ok(
        &app,
        "PUT",
        &format!("/api/v1/tasks/{}/assignment", id(&root)),
        json!({"executorAgentId":id(&a),"coordinationContext":manual()}),
        ver(&root),
    )
    .await;
    assert_eq!(root["authorAgentId"], a["id"]);
    assert!(root.get("contextSummary").is_none());
    let timeline = get(
        &app,
        &format!("/api/v1/tasks/{}/timeline?includeChildren=true", id(&root)),
    )
    .await;
    assert!(timeline["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["taskId"] == grandchild["id"]));
    let matches = get(&app, "/api/v1/agents?name=100%25_literal").await;
    assert!(matches["total"].as_u64().unwrap() >= 1);
    let empty = get(&app, "/api/v1/agents?offset=2147483647").await;
    assert_eq!(empty["items"], json!([]));
    assert_eq!(empty["hasMore"], false);
    assert_eq!(
        request(&app, "GET", "/api/v1/agents?name=a&name=b", json!({}), None)
            .await
            .0,
        400
    );
    assert_eq!(
        request(&app, "GET", "/api/v1/tasks?teamId=bad", json!({}), None)
            .await
            .0,
        400
    );
    let a_now = get(&app, &format!("/api/v1/agents/{}", id(&a))).await;
    let chat=ok(&app,"POST",&format!("/api/v1/agents/{}/chat-references",id(&a)),json!({"harness":"codex","externalId":uuid::Uuid::new_v4().to_string(),"label":"Task conversation","url":"codex://threads/example"}),ver(&a_now)).await;
    ok(
        &app,
        "PATCH",
        &format!("/api/v1/agents/{}/chat-references/{}", id(&a), id(&chat)),
        json!({"label":"Updated"}),
        ver(&chat),
    )
    .await;
    get(&app, &format!("/api/v1/agents/{}/chat-references", id(&a))).await;
    let resume = get(
        &app,
        &format!(
            "/api/v1/agents/{}/resumption-context?taskIds={}",
            id(&a),
            id(&root)
        ),
    )
    .await;
    assert_eq!(resume["taskIds"], json!([id(&root)]));
    let activities = get(
        &app,
        &format!("/api/v1/agents/{}/activities?relation=authored", id(&a)),
    )
    .await;
    assert!(activities["total"].as_u64().unwrap() >= 2);
    get(&app, &format!("/api/v1/boards/{}/view", id(&board))).await;
    get(&app, &format!("/api/v1/boards/{}/tasks", id(&board))).await;
    get(&app, &format!("/api/v1/boards/{}/statuses", id(&board))).await;
    get(&app, &format!("/api/v1/teams/{}/members", id(&t2))).await;
    get(&app, "/api/v1/boards").await;
    get(&app, "/api/v1/teams").await;
}
