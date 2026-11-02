#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

#[tokio::test]
async fn board_columns_include_local_descendants_with_independent_status_and_pagination() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Board worker"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Board team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let mut boards = Vec::new();
    for name in ["Local", "Other"] {
        boards.push(
            ok(
                &app,
                "POST",
                "/api/v1/boards",
                json!({"name":name,"teamId":id(&team)}),
                None,
            )
            .await,
        );
    }
    let create = |title: &str, parent: Value| json!({"title":title,"parentId":parent,"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()});
    let local = format!("/api/v1/boards/{}", id(&boards[0]));
    let other = format!("/api/v1/boards/{}", id(&boards[1]));
    let root = ok(
        &app,
        "POST",
        &format!("{local}/tasks"),
        create("Root", Value::Null),
        None,
    )
    .await;
    let child = ok(
        &app,
        "POST",
        &format!("{local}/tasks"),
        create("Local child", root["id"].clone()),
        ver(&root),
    )
    .await;
    let root = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    let foreign = ok(
        &app,
        "POST",
        &format!("{other}/tasks"),
        create("Foreign child", root["id"].clone()),
        ver(&root),
    )
    .await;
    let grandchild = ok(
        &app,
        "POST",
        &format!("{local}/tasks"),
        create("Local grandchild", foreign["id"].clone()),
        ver(&foreign),
    )
    .await;
    let view = get(&app, &format!("{local}/view?limitPerColumn=1")).await;
    let column = view["columns"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["status"]["id"] == root["statusId"])
        .unwrap();
    assert_eq!(
        column["total"], 3,
        "all local descendants must count, foreign descendants must not"
    );
    assert_eq!(column["tasks"].as_array().unwrap().len(), 1);
    assert_eq!(column["hasMore"], true);
    assert_eq!(column["nextOffset"], 1);
    let mut ids = vec![column["tasks"][0]["id"].clone()];
    for offset in [1, 2] {
        let page = get(
            &app,
            &format!(
                "{local}/tasks?statusId={}&archived=false&sortBy=position&limit=1&offset={offset}",
                root["statusId"].as_str().unwrap()
            ),
        )
        .await;
        assert_eq!(page["total"], 3);
        ids.push(page["items"][0]["id"].clone());
    }
    for task in [&root, &child, &grandchild] {
        assert!(ids.contains(&task["id"]));
    }
    assert!(!ids.contains(&foreign["id"]));
    let all = get(&app, &format!("{local}/tasks")).await;
    for (task, parent) in [(&child, &root), (&grandchild, &foreign)] {
        let item = all["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|i| i["id"] == task["id"])
            .unwrap();
        assert_eq!(
            item["parentReference"],
            json!({"id":parent["id"],"title":parent["title"],"slug":parent["slug"]})
        );
    }
    assert!(all["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["id"] == root["id"])
        .unwrap()["parentReference"]
        .is_null());
    assert_eq!(
        get(&app, &format!("{local}/tasks?rootOnly=true")).await["total"],
        1
    );
    let filtered = get(&app, &format!("{local}/view?title=Local%20child")).await;
    assert_eq!(
        filtered["columns"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["total"].as_i64().unwrap())
            .sum::<i64>(),
        1
    );

    let response=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getBoardView","arguments":{"params":{"boardId":id(&boards[0])},"query":{"limitPerColumn":1}}}}).to_string())).unwrap()).await.unwrap();
    let rpc: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(rpc["result"]["isError"], false, "{rpc}");
    assert_eq!(rpc["result"]["structuredContent"]["data"], view);

    let mother_before = get(&app, &format!("/api/v1/tasks/{}", id(&root))).await;
    let target = boards[0]["statuses"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] != root["statusId"] && s["isDone"] == false)
        .unwrap();
    let child = get(&app, &format!("/api/v1/tasks/{}", id(&child))).await;
    let moved=ok(&app,"POST",&format!("/api/v1/tasks/{}/execution-summaries",id(&child)),json!({"statusId":target["id"],"currentSummary":"Moved child to its own active status.","summary":"Child status transition","outcome":"progress","usageReport":unavailable_usage(),"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&root),"originBoardId":id(&boards[0])}}),ver(&child)).await["task"].clone();
    assert_eq!(moved["parentId"], root["id"]);
    assert_eq!(moved["statusId"], target["id"]);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&root))).await,
        mother_before
    );
    let after = get(&app, &format!("{local}/view")).await;
    let target_column = after["columns"]
        .as_array()
        .unwrap()
        .iter()
        .find(|c| c["status"]["id"] == target["id"])
        .unwrap();
    assert_eq!(target_column["total"], 1);
    assert_eq!(target_column["tasks"][0]["id"], child["id"]);
    ok(
        &app,
        "PUT",
        &format!("/api/v1/tasks/{}/archive", id(&moved)),
        json!({"archived":true}),
        ver(&moved),
    )
    .await;
    let archived = get(&app, &format!("{local}/view")).await;
    assert_eq!(
        archived["columns"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| c["total"].as_i64().unwrap())
            .sum::<i64>(),
        2
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&root))).await,
        mother_before
    );
}
