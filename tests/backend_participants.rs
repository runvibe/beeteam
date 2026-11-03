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

async fn success(app: &Router, name: &str, args: Value) -> Value {
    let r = tool(app, name, args).await;
    assert_eq!(r["isError"], false, "{name}: {r}");
    r["structuredContent"].clone()
}
async fn mutation(app: &Router, task: &Value, actor: &Value, name: &str, body: Value) -> Value {
    let current = get(app, &format!("/api/v1/tasks/{}", id(task))).await;
    success(app,name,json!({"params":{"taskId":id(task)},"actor":actor,"expectedVersion":current["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":body})).await
}
#[tokio::test]
async fn participants_cover_exact_task_history_without_global_or_comment_page_leakage() {
    let app = app().await;
    let mut agents = Vec::new();
    for name in [
        "Author",
        "Old executor",
        "Executor",
        "Commenter",
        "Planner",
        "Uploader",
        "Reporter",
        "Event actor",
        "Other task only",
        "Child only",
    ] {
        agents.push(ok(&app, "POST", "/api/v1/agents", json!({"name":name}), None).await);
    }
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Participants","leaderId":id(&agents[0]),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Participants","teamId":id(&team)}),
        None,
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Main","authorAgentId":id(&agents[0]),"executorAgentId":id(&agents[1]),"coordinationContext":manual()}),None).await;
    let human = json!({"kind":"human"});
    let actor = |index: usize| json!({"kind":"agent","id":id(&agents[index])});
    mutation(
        &app,
        &task,
        &human,
        "assignTask",
        json!({"executorAgentId":id(&agents[2]),"coordinationContext":manual()}),
    )
    .await;
    for body in ["Earlier unrelated text", "Later target"] {
        mutation(
            &app,
            &task,
            &actor(3),
            "createComment",
            json!({"body":body}),
        )
        .await;
    }
    mutation(
        &app,
        &task,
        &human,
        "createComment",
        json!({"body":"Human comment"}),
    )
    .await;
    mutation(
        &app,
        &task,
        &actor(4),
        "createPlan",
        json!({"title":"Plan","content":"# Test plan"}),
    )
    .await;
    let current = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    let attachment=success(&app,"createAttachment",json!({"params":{"taskId":id(&task)},"actor":actor(5),"expectedVersion":current["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":{"description":"Test"},"upload":{"name":"test.txt","mediaType":"text/plain","dataBase64":"dGVzdA=="}})).await;
    mutation(&app,&task,&actor(6),"createExecutionSummary",json!({"currentSummary":"Test summary","usageReport":session_usage(task["executorAgentId"].as_str().unwrap()),"summary":"Recorded report","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&task),"originBoardId":id(&board)}})).await;
    mutation(
        &app,
        &task,
        &actor(7),
        "updateTask",
        json!({"title":"Renamed"}),
    )
    .await;
    let other=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Other","authorAgentId":id(&agents[8]),"executorAgentId":id(&agents[8]),"coordinationContext":manual()}),None).await;
    mutation(
        &app,
        &other,
        &actor(8),
        "createComment",
        json!({"body":"Other task"}),
    )
    .await;
    let current = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Child","parentId":id(&task),"authorAgentId":id(&agents[9]),"executorAgentId":id(&agents[9]),"coordinationContext":manual()}),ver(&current)).await;
    // Removed attachments retain their author's participation via the upload event.
    let current = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    success(&app,"removeAttachment",json!({"params":{"taskId":id(&task),"attachmentId":attachment["data"]["id"]},"actor":human,"expectedVersion":current["version"]})).await;
    let commenter = get(&app, &format!("/api/v1/agents/{}", id(&agents[3]))).await;
    success(&app,"archiveAgent",json!({"params":{"agentId":id(&commenter)},"actor":human,"expectedVersion":commenter["version"],"body":{"archived":true}})).await;
    let before = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    let comments = get(
        &app,
        &format!(
            "/api/v1/tasks/{}/comments?limit=1&text=unmatched",
            id(&task)
        ),
    )
    .await;
    assert_eq!(comments["total"], 0);
    let mut items = Vec::new();
    let mut offset = 0;
    loop {
        let http = get(
            &app,
            &format!(
                "/api/v1/tasks/{}/participants?limit=2&offset={offset}",
                id(&task)
            ),
        )
        .await;
        let mcp = success(
            &app,
            "listTaskParticipants",
            json!({"params":{"taskId":id(&task)},"query":{"limit":2,"offset":offset}}),
        )
        .await;
        assert_eq!(mcp["data"], http);
        assert_eq!(http["total"], 9);
        items.extend(http["items"].as_array().unwrap().clone());
        if http["hasMore"] == false {
            assert!(http["nextOffset"].is_null());
            break;
        }
        offset = http["nextOffset"].as_u64().unwrap();
    }
    assert_eq!(items.len(), 9);
    let unknown = uuid::Uuid::now_v7();
    assert_eq!(
        get(
            &app,
            &format!("/api/v1/tasks/{}/comments?actorId={unknown}", id(&task))
        )
        .await["total"],
        0
    );
    assert_eq!(
        success(
            &app,
            "listComments",
            json!({"params":{"taskId":id(&task)},"query":{"actorId":unknown}})
        )
        .await["data"]["total"],
        0
    );

    for agent in &agents[..8] {
        assert_eq!(
            items.iter().filter(|p| p["actorId"] == agent["id"]).count(),
            1
        );
    }
    assert!(items
        .iter()
        .all(|p| p["actorId"] != agents[8]["id"] && p["actorId"] != agents[9]["id"]));
    let anonymous = items.iter().find(|p| p["actorKind"] == "human").unwrap();
    assert!(anonymous["actorId"].is_null() && anonymous["agentName"].is_null());
    let archived = items
        .iter()
        .find(|p| p["actorId"] == agents[3]["id"])
        .unwrap();
    assert_eq!(archived["agentArchived"], true);
    assert_eq!(archived["agentName"], "Commenter");
    let empty = get(
        &app,
        &format!("/api/v1/tasks/{}/participants?offset=99", id(&task)),
    )
    .await;
    assert_eq!(empty["total"], 9);
    assert_eq!(empty["items"], json!([]));
    assert_eq!(empty["hasMore"], false);
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/tasks/{}/participants?text=target", id(&task)),
            json!({}),
            None
        )
        .await
        .0,
        400
    );
    assert_eq!(
        tool(
            &app,
            "listTaskParticipants",
            json!({"params":{"taskId":id(&task)},"query":{"text":"target"}})
        )
        .await["isError"],
        true
    );
    let absent = uuid::Uuid::now_v7();
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/tasks/{absent}/participants"),
            json!({}),
            None
        )
        .await
        .0,
        404
    );
    assert_eq!(
        tool(
            &app,
            "listTaskParticipants",
            json!({"params":{"taskId":absent}})
        )
        .await["structuredContent"]["code"],
        "not_found"
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&task))).await,
        before
    );
}
