mod managed_fixture;
mod support;
use managed_fixture::*;
use serde_json::{json, Value};
use support::*;
use uuid::Uuid;

fn spec() -> Value {
    serde_json::from_str(include_str!(
        "../docs/proposals/managed-agents-openapi.json"
    ))
    .unwrap()
}

fn conforms(schema: &str, value: &Value) {
    let spec = spec();
    beeteam::dto::contracts::validate_schema(&spec, &spec["components"]["schemas"][schema], value)
        .unwrap_or_else(|e| panic!("{schema}: {e}\n{value}"));
}

async fn send(app: &axum::Router, agent: &Value, body: Value) -> (u16, Value) {
    request(
        app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(agent)),
        body,
        None,
    )
    .await
}

async fn session(app: &axum::Router, agent: &Value, body: Value) -> String {
    let r = send(app, agent, body).await;
    assert_eq!(r.0, 202, "{r:?}");
    wait_state(app, &r.1, "completed").await;
    r.1["conversationId"].as_str().unwrap().to_owned()
}

async fn list(app: &axum::Router, query: &str) -> Value {
    let page = get(app, &format!("/api/v2/agent-conversations{query}")).await;
    conforms("ConversationPage", &page);
    page
}

fn ids(page: &Value) -> Vec<String> {
    page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["id"].as_str().unwrap().to_owned())
        .collect()
}

async fn board(app: &axum::Router, team: &Value, name: &str) -> Value {
    ok(
        app,
        "POST",
        "/api/v2/boards",
        json!({"name":name,"teamId":id(team),"statuses":[{"name":"Open","isDone":false},{"name":"Done","isDone":true}]}),
        None,
    )
    .await
}

async fn second_team(app: &axum::Router) -> (Value, Value) {
    let agent = ok(
        app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Second leader"}),
        None,
    )
    .await;
    let team = ok(
        app,
        "POST",
        "/api/v2/teams",
        json!({"name":"Second team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let agent = get(app, &format!("/api/v2/agents/{}", id(&agent))).await;
    let cfg = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    let r = request(
        app,
        "PUT",
        &format!("/api/v2/agents/{}/execution-config", id(&agent)),
        cfg,
        ver(&agent),
    )
    .await;
    assert_eq!(r.0, 200, "{r:?}");
    (agent, team)
}

#[tokio::test]
async fn team_sessions_are_filtered_sorted_and_paginated() {
    let (app, a, team, _) = configured().await;
    let (b, other) = second_team(&app).await;
    let planning = board(&app, &team, "Planning").await;
    let foreign = board(&app, &other, "Foreign").await;

    let s1 = session(
        &app,
        &a,
        json!({"content":"first","teamId":id(&team),"boardId":id(&planning)}),
    )
    .await;
    let s2 = session(&app, &a, json!({"content":"second","teamId":id(&team)})).await;
    let s3 = session(&app, &b, json!({"content":"third","teamId":id(&other)})).await;
    let direct = session(&app, &a, json!({"content":"direct"})).await;

    let all = list(&app, "").await;
    assert_eq!(ids(&all), [s3.as_str(), s2.as_str(), s1.as_str()]);
    assert!(!ids(&all).contains(&direct));
    assert_eq!(all["items"][2]["teamId"], id(&team));
    assert_eq!(all["items"][2]["boardId"], id(&planning));
    assert_eq!(all["nextCursor"], Value::Null);

    assert_eq!(ids(&list(&app, "?sort=updated_asc").await), [s1.as_str(), s2.as_str(), s3.as_str()]);
    assert_eq!(
        ids(&list(&app, &format!("?teamId={}", id(&team))).await),
        [s2.as_str(), s1.as_str()]
    );
    assert_eq!(
        ids(&list(&app, &format!("?agentId={}", id(&b))).await),
        [s3.as_str()]
    );
    assert_eq!(
        ids(&list(&app, &format!("?boardId={}", id(&planning))).await),
        [s1.as_str()]
    );
    assert_eq!(ids(&list(&app, "?boardId=none").await), [s3.as_str(), s2.as_str()]);
    assert_eq!(
        ids(&list(&app, &format!("?boardId=none,{}", id(&planning))).await),
        [s3.as_str(), s2.as_str(), s1.as_str()]
    );
    assert_eq!(
        ids(&list(&app, &format!("?teamId={},{}", id(&team), id(&other))).await).len(),
        3
    );

    let first = list(&app, "?limit=2").await;
    assert_eq!(ids(&first), [s3.as_str(), s2.as_str()]);
    let cursor = first["nextCursor"].as_str().unwrap();
    let rest = list(&app, &format!("?limit=2&cursor={cursor}")).await;
    assert_eq!(ids(&rest), [s1.as_str()]);
    assert_eq!(rest["nextCursor"], Value::Null);

    for bad in [
        format!("?sort=updated_asc&cursor={cursor}"),
        "?limit=0".into(),
        "?limit=101".into(),
        "?sort=name".into(),
        "?teamId=nope".into(),
        "?unknown=1".into(),
    ] {
        let r = request(
            &app,
            "GET",
            &format!("/api/v2/agent-conversations{bad}"),
            json!({}),
            None,
        )
        .await;
        assert_eq!(r.0, 400, "{bad}: {r:?}");
    }

    // Continuing a session moves it to the top of the default order.
    let r = send(&app, &a, json!({"content":"again","conversationId":s1})).await;
    assert_eq!(r.0, 202, "{r:?}");
    wait_state(&app, &r.1, "completed").await;
    assert_eq!(ids(&list(&app, "").await), [s1.as_str(), s3.as_str(), s2.as_str()]);

    let mismatch = send(
        &app,
        &a,
        json!({"content":"x","conversationId":s1,"teamId":id(&other)}),
    )
    .await;
    assert_eq!(mismatch.0, 409, "{mismatch:?}");
    let foreign_board = send(
        &app,
        &a,
        json!({"content":"x","teamId":id(&team),"boardId":id(&foreign)}),
    )
    .await;
    assert_eq!(foreign_board.0, 400, "{foreign_board:?}");
    let not_leader = send(&app, &a, json!({"content":"x","teamId":id(&other)})).await;
    assert_eq!(not_leader.0, 409, "{not_leader:?}");
    let orphan_board = send(&app, &a, json!({"content":"x","boardId":id(&planning)})).await;
    assert_eq!(orphan_board.0, 400, "{orphan_board:?}");
}

#[tokio::test]
async fn an_individual_conversation_can_be_loaded_without_paging() {
    let (app, agent, team, _) = configured().await;
    let board = board(&app, &team, "Planning").await;
    let sid = session(
        &app,
        &agent,
        json!({"content":"older session","teamId":id(&team),"boardId":id(&board)}),
    )
    .await;

    let response = request(
        &app,
        "GET",
        &format!("/api/v2/agent-conversations/{sid}"),
        json!({}),
        None,
    )
    .await;
    assert_eq!(response.0, 200, "{response:?}");
    conforms("Conversation", &response.1);
    assert_eq!(response.1["id"], sid);
    assert_eq!(response.1["boardId"], id(&board));

    let missing = request(
        &app,
        "GET",
        &format!("/api/v2/agent-conversations/{}", Uuid::now_v7()),
        json!({}),
        None,
    )
    .await;
    assert_eq!(missing.0, 404, "{missing:?}");

    let invalid_query = request(
        &app,
        "GET",
        &format!("/api/v2/agent-conversations/{sid}?limit=1"),
        json!({}),
        None,
    )
    .await;
    assert_eq!(invalid_query.0, 400, "{invalid_query:?}");

    let direct = session(&app, &agent, json!({"content":"direct"})).await;
    let direct = get(&app, &format!("/api/v2/agent-conversations/{direct}")).await;
    conforms("Conversation", &direct);
    assert_eq!(direct["teamId"], Value::Null);
}

#[tokio::test]
async fn session_board_and_title_are_versioned_updates() {
    let (app, a, team, _) = configured().await;
    let (_, other) = second_team(&app).await;
    let planning = board(&app, &team, "Planning").await;
    let foreign = board(&app, &other, "Foreign").await;
    let sid = session(&app, &a, json!({"content":"hello","teamId":id(&team)})).await;
    let direct = session(&app, &a, json!({"content":"direct"})).await;
    let path = format!("/api/v2/agent-conversations/{sid}");
    let current = list(&app, "").await["items"][0].clone();
    let version = ver(&current);

    let r = request(&app, "PATCH", &path, json!({"boardId":id(&planning)}), None).await;
    assert_eq!(r.0, 428, "{r:?}");
    let r = request(
        &app,
        "PATCH",
        &path,
        json!({"boardId":id(&planning)}),
        Some(version.unwrap() + 7),
    )
    .await;
    assert_eq!(r.0, 412, "{r:?}");
    let r = request(&app, "PATCH", &path, json!({"boardId":id(&foreign)}), version).await;
    assert_eq!(r.0, 400, "{r:?}");
    for bad in [json!({}), json!({"title":""}), json!({"color":"red"})] {
        let r = request(&app, "PATCH", &path, bad.clone(), version).await;
        assert_eq!(r.0, 400, "{bad}: {r:?}");
    }
    let r = request(
        &app,
        "PATCH",
        &format!("/api/v2/agent-conversations/{direct}"),
        json!({"boardId":id(&planning)}),
        Some(1),
    )
    .await;
    assert!(matches!(r.0, 400 | 412), "{r:?}");

    let key = Uuid::new_v4();
    let body = json!({"boardId":id(&planning),"title":"Roadmap"});
    let updated = request_key(&app, "PATCH", &path, body.clone(), version, key).await;
    assert_eq!(updated.0, 200, "{updated:?}");
    conforms("Conversation", &updated.1);
    assert_eq!(updated.1["boardId"], id(&planning));
    assert_eq!(updated.1["title"], "Roadmap");
    assert!(ver(&updated.1) > version);
    let replay = request_key(&app, "PATCH", &path, body, version, key).await;
    assert_eq!(replay, updated);
    assert_eq!(
        ids(&list(&app, &format!("?boardId={}", id(&planning))).await),
        [sid.as_str()]
    );

    let cleared = request(&app, "PATCH", &path, json!({"boardId":null}), ver(&updated.1)).await;
    assert_eq!(cleared.0, 200, "{cleared:?}");
    assert_eq!(cleared.1["boardId"], Value::Null);
    assert_eq!(cleared.1["title"], "Roadmap");
    assert_eq!(ids(&list(&app, "?boardId=none").await), [sid.as_str()]);
}

#[cfg(feature = "mcp")]
#[tokio::test]
async fn mcp_lists_sessions_like_http() {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, a, team, _) = configured().await;
    let sid = session(&app, &a, json!({"content":"hello","teamId":id(&team)})).await;
    let http = list(&app, &format!("?teamId={}", id(&team))).await;
    let call = json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"listAgentSessions","arguments":{"query":{"teamId":id(&team)}}}});
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/mcp")
                .header("host", "127.0.0.1")
                .header("content-type", "application/json")
                .header("accept", "application/json, text/event-stream")
                .header("mcp-protocol-version", "2025-11-25")
                .body(Body::from(call.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let result: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(result["result"]["isError"], false, "{result}");
    assert_eq!(result["result"]["structuredContent"]["data"], http);

    let detail = get(&app, &format!("/api/v2/agent-conversations/{sid}")).await;
    let call = json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"getAgentConversation","arguments":{"params":{"conversationId":sid}}}});
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/mcp")
                .header("host", "127.0.0.1")
                .header("content-type", "application/json")
                .header("accept", "application/json, text/event-stream")
                .header("mcp-protocol-version", "2025-11-25")
                .body(Body::from(call.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let result: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(result["result"]["isError"], false, "{result}");
    assert_eq!(result["result"]["structuredContent"]["data"], detail);
}
