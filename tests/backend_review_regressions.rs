mod support;
use serde_json::json;
use support::*;

#[test]
fn failure_payloads_match_both_error_contracts() {
    for name in ["getAgent", "getTask"] {
        let op = beeteam::dto::contracts::operation(name).unwrap();
        let schema = &op.document["components"]["schemas"]["Error"];
        beeteam::dto::contracts::validate_schema(
            &op.document,
            schema,
            &json!(beeteam::dto::backend::Failure::invalid("bad request")),
        )
        .unwrap();
    }
}

#[tokio::test]
async fn cannot_archive_executor_with_unfinished_task_even_without_role_bindings() {
    let app = app().await;
    let a = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Leader"}),
        None,
    )
    .await;
    let b = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Unbound executor"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Team","leaderId":id(&a),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Board","teamId":id(&team)}),
        None,
    )
    .await;
    let root=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Root","workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&b),"coordinationContext":manual()}),None).await;
    let status = request(
        &app,
        "PUT",
        &format!("/api/v1/agents/{}/archive", id(&b)),
        json!({"archived":true}),
        ver(&b),
    )
    .await
    .0;
    assert_eq!(
        status, 409,
        "An unfinished task still requires this executor"
    );
    let root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    assert_eq!(root["executorAgentId"], b["id"]);
}

#[tokio::test]
async fn activity_archive_filters_include_inherited_cross_board_archive() {
    let app = app().await;
    let a = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Agent"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Team","leaderId":id(&a),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Origin","teamId":id(&team)}),
        None,
    )
    .await;
    let destination = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Destination","teamId":id(&team)}),
        None,
    )
    .await;
    let root=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Root","workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),None).await;
    ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&destination)),json!({"title":"Child","parentId":id(&root),"workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),ver(&root)).await;
    let root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    ok(
        &app,
        "PUT",
        &format!("/api/v1/tasks/{}/archive", id(&root)),
        json!({"archived":true}),
        ver(&root),
    )
    .await;
    assert_eq!(
        get(
            &app,
            &format!("/api/v1/agents/{}/activities?archived=false", id(&a))
        )
        .await["total"],
        0
    );
    assert_eq!(
        get(
            &app,
            &format!("/api/v1/agents/{}/activities?archived=true", id(&a))
        )
        .await["total"],
        2
    );
}

#[tokio::test]
async fn uppercase_uuid_paths_and_filters_match_lowercase_records() {
    let app = app().await;
    let a = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Agent"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Team","leaderId":id(&a),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Board","teamId":id(&team)}),
        None,
    )
    .await;
    ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Task","workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),None).await;
    assert_eq!(
        get(
            &app,
            &format!("/api/v1/boards/{}/tasks", id(&board).to_uppercase())
        )
        .await["total"],
        1
    );
    assert_eq!(
        get(
            &app,
            &format!("/api/v1/tasks?executorAgentId={}", id(&a).to_uppercase())
        )
        .await["total"],
        1
    );
}
