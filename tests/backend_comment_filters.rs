#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn tool(app: &Router, name: &str, arguments: Value) -> Value {
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/mcp")
        .header("host","127.0.0.1").header("content-type","application/json")
        .header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":arguments}}).to_string())).unwrap()).await.unwrap();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let response: Value = serde_json::from_slice(&bytes).unwrap();
    response["result"].clone()
}

async fn filtered(app: &Router, task: &Value, query: Value) -> Value {
    let mut url = url::Url::parse(&format!(
        "http://localhost/api/v1/tasks/{}/comments",
        id(task)
    ))
    .unwrap();
    for (key, value) in query.as_object().unwrap() {
        url.query_pairs_mut().append_pair(
            key,
            &value
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| value.to_string()),
        );
    }
    let http = get(
        app,
        &format!("{}?{}", url.path(), url.query().unwrap_or("")),
    )
    .await;
    let mcp = tool(
        app,
        "listComments",
        json!({"params":{"taskId":id(task)},"query":query}),
    )
    .await;
    assert_eq!(mcp["isError"], false, "{mcp}");
    assert_eq!(mcp["structuredContent"]["data"], http);
    http
}

#[tokio::test]
async fn comment_filters_are_literal_combined_and_paginated_in_http_and_mcp() {
    let app = app().await;
    let a = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Author A"}),
        None,
    )
    .await;
    let b = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Author B"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Authors","leaderId":id(&a),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Comments","teamId":id(&team)}),
        None,
    )
    .await;
    let mut tasks = Vec::new();
    for title in ["Main", "Other"] {
        tasks.push(ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":title,"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),None).await);
    }
    let human = json!({"kind":"human"});
    let agent_a = json!({"kind":"agent","id":id(&a)});
    let agent_b = json!({"kind":"agent","id":id(&b)});
    let bodies = [
        (
            human.clone(),
            "Prefix **Palette** 100%_\\ literal ' OR 1=1 --",
        ),
        (agent_a.clone(), "Palette Árvore"),
        (agent_b.clone(), "palette árvore"),
        (human.clone(), "Other"),
        (agent_a.clone(), "late Palette Árvore"),
        (agent_b.clone(), "Palette [.*]"),
        (human.clone(), "literal 100X_Y"),
    ];
    let mut comments = Vec::new();
    for (actor, body) in bodies {
        let current = get(&app, &format!("/api/v1/tasks/{}", id(&tasks[0]))).await;
        let result=tool(&app,"createComment",json!({"params":{"taskId":id(&current)},"body":{"body":body},"actor":actor,"expectedVersion":current["version"],"idempotencyKey":uuid::Uuid::new_v4()})).await;
        assert_eq!(result["isError"], false, "{result}");
        comments.push(result["structuredContent"]["data"].clone());
    }
    ok(
        &app,
        "POST",
        &format!("/api/v1/tasks/{}/comments", id(&tasks[1])),
        json!({"body":"Palette"}),
        ver(&tasks[1]),
    )
    .await;
    for (query, total) in [
        (json!({}), 7),
        (json!({"text":""}), 7),
        (json!({"text":"Palette"}), 4),
        (json!({"text":"PALETTE"}), 0),
        (json!({"text":"árvore"}), 1),
        (json!({"text":"arvore"}), 0),
        (json!({"text":"100%_\\"}), 1),
        (json!({"text":"[.*]"}), 1),
        (json!({"text":"' OR 1=1 --"}), 1),
        (json!({"text":" Palette Árvore"}), 1),
        (json!({"actorKind":"human"}), 3),
        (json!({"actorKind":"agent"}), 4),
        (json!({"actorKind":"human","text":"Palette"}), 1),
        (
            json!({"actorKind":"agent","actorId":id(&a),"text":"Árvore"}),
            2,
        ),
        (json!({"actorKind":"human","actorId":id(&a)}), 0),
    ] {
        assert_eq!(
            filtered(&app, &tasks[0], query.clone()).await["total"],
            total,
            "{query}"
        );
    }
    let first = filtered(&app, &tasks[0], json!({"text":"Palette","limit":1})).await;
    assert_eq!(first["total"], 4);
    assert_eq!(first["items"][0], comments[0]);
    assert_eq!(first["hasMore"], true);
    assert_eq!(first["nextOffset"], 1);
    let last = filtered(
        &app,
        &tasks[0],
        json!({"text":"Palette","limit":1,"offset":3}),
    )
    .await;
    assert_eq!(last["items"][0], comments[5]);
    assert_eq!(last["hasMore"], false);
    assert!(last["nextOffset"].is_null());
    let reverse = filtered(
        &app,
        &tasks[0],
        json!({"text":"Palette","limit":1,"sortOrder":"desc"}),
    )
    .await;
    assert_eq!(reverse["items"], last["items"]);
    let beyond = filtered(&app, &tasks[0], json!({"text":"Palette","offset":99})).await;
    assert_eq!(beyond["total"], 4);
    assert_eq!(beyond["items"], json!([]));
    assert_eq!(beyond["hasMore"], false);
    for query in [
        json!({"actorKind":"robot"}),
        json!({"text":"x".repeat(1025)}),
        json!({"text":"\u{0000}"}),
        json!({"actorId":"invalid"}),
    ] {
        let mut url = url::Url::parse(&format!(
            "http://localhost/api/v1/tasks/{}/comments",
            id(&tasks[0])
        ))
        .unwrap();
        for (key, value) in query.as_object().unwrap() {
            url.query_pairs_mut()
                .append_pair(key, value.as_str().unwrap());
        }
        assert_eq!(
            request(
                &app,
                "GET",
                &format!("{}?{}", url.path(), url.query().unwrap()),
                json!({}),
                None
            )
            .await
            .0,
            400
        );
        let mcp = tool(
            &app,
            "listComments",
            json!({"params":{"taskId":id(&tasks[0])},"query":query}),
        )
        .await;
        assert_eq!(mcp["isError"], true);
        assert_eq!(mcp["structuredContent"]["code"], "invalid_request");
    }
    assert_eq!(
        filtered(&app, &tasks[0], json!({})).await["items"],
        json!(comments)
    );
}
