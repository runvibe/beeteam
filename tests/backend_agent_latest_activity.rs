#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn latest(app: &Router, agent: &Value) -> Value {
    let http = get(
        app,
        &format!("/api/v1/agents/{}/latest-activity", id(agent)),
    )
    .await;
    let mcp = tool(app, agent).await;
    assert_eq!(mcp["result"]["isError"], false, "{mcp}");
    assert_eq!(mcp["result"]["structuredContent"]["data"], http);
    http
}

async fn tool(app: &Router, agent: &Value) -> Value {
    let response = app.clone().oneshot(Request::post("/mcp")
        .header("host", "127.0.0.1").header("content-type", "application/json")
        .header("accept", "application/json, text/event-stream")
        .header("mcp-protocol-version", "2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getAgentLatestActivity","arguments":{"params":{"agentId":id(agent)}}}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap()
}

#[tokio::test]
async fn no_activity_is_null_and_missing_agent_is_an_error() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"No recorded activity"}),
        None,
    )
    .await;
    assert_eq!(latest(&app, &agent).await, json!({"activity":null}));
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/agents/{}/latest-activity", uuid::Uuid::now_v7()),
            Value::Null,
            None
        )
        .await
        .0,
        404
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/agents/not-a-uuid/latest-activity",
            Value::Null,
            None
        )
        .await
        .0,
        400
    );
    assert_eq!(
        tool(&app, &json!({"id":Uuid::now_v7()})).await["result"]["isError"],
        true
    );
}

use beeteam::repositories::{
    contracts::{ResourceStore, UnitOfWork},
    records::Record,
};
use uuid::Uuid;

async fn fixture() -> (Router, Box<dyn ResourceStore>, Value, Value, Value, Value) {
    let (app, store): (Router, Box<dyn ResourceStore>) =
        if std::env::var("BEE_TEST_DRIVER").as_deref() == Ok("sqlite") {
            let (app, pool) = sqlite_app_with_pool().await;
            (
                app,
                Box::new(beeteam::repositories::sqlite::ResourceRepository::new(pool)),
            )
        } else {
            let (app, pool) = app_with_pool().await;
            (
                app,
                Box::new(beeteam::repositories::resources::ResourceRepository::new(
                    pool,
                )),
            )
        };
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Activity author"}),
        None,
    )
    .await;
    let other = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Another author"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Activity team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Activity board","teamId":id(&team)}),
        None,
    )
    .await;
    let task = ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Attributed task","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual(),"workScope":test_project_scope()}),None).await;
    (app, store, agent, other, board, task)
}
async fn event(
    unit: &mut UnitOfWork,
    task: &Value,
    actor: &Value,
    kind: &str,
    stamp: &str,
    data: Value,
) -> Uuid {
    let sequence = unit.sequence().await.unwrap();
    unit.records.insert(Record::new("events",json!({"taskId":id(task),"actorKind":"agent","actorId":id(actor),"type":kind,"occurredAt":stamp,"sequence":sequence,"data":data})))
}
fn key(value: &Value) -> Uuid {
    Uuid::parse_str(id(value)).unwrap()
}

#[tokio::test]
async fn latest_event_uses_own_actor_instant_sequence_and_explicit_summary() {
    let (app, store, agent, other, board, task) = fixture().await;
    // Being author/executor of a human-created task is not a recorded agent action.
    assert_eq!(latest(&app, &agent).await, json!({"activity":null}));
    let mut unit = store.begin().await.unwrap();
    let first = event(
        &mut unit,
        &task,
        &agent,
        "comment.created",
        "2026-11-04T10:00:00.900000001Z",
        json!({}),
    )
    .await;
    // Equivalent instant with a different offset/precision: later sequence wins.
    let winner = event(
        &mut unit,
        &task,
        &agent,
        "task.updated",
        "2026-11-04T07:00:00.900000001-03:00",
        json!({}),
    )
    .await;
    event(
        &mut unit,
        &task,
        &agent,
        "block.changed",
        "2026-11-04T10:00:00.900000000Z",
        json!({}),
    )
    .await;
    event(
        &mut unit,
        &task,
        &agent,
        "task.updated",
        "2026-11-04T11:00:00+02:00",
        json!({}),
    )
    .await;
    // A greater sequence or unrelated author must not replace the latest own instant.
    for _ in 0..60 {
        event(
            &mut unit,
            &task,
            &other,
            "task.updated",
            "2099-01-01T00:00:00Z",
            json!({}),
        )
        .await;
    }
    let human = event(
        &mut unit,
        &task,
        &agent,
        "task.updated",
        "2099-01-01T00:00:00Z",
        json!({}),
    )
    .await;
    unit.records.get_mut("events", human).unwrap().data["actorKind"] = json!("human");
    unit.commit().await.unwrap();
    let expected = json!({"activity":{"type":"task.updated","occurredAt":"2026-11-04T07:00:00.900000001-03:00","eventId":winner,"summaryId":null,"taskId":id(&task),"taskSlug":task["slug"],"taskTitle":task["title"]}});
    assert_eq!(latest(&app, &agent).await, expected);

    let command = beeteam::dto::backend::Command {
        operation: "getAgentLatestActivity".into(),
        params: [("agentId".into(), id(&agent).into())].into(),
        query: Default::default(),
        body: Value::Null,
        actor: None,
        expected_version: None,
        idempotency_key: None,
        upload: None,
    };
    let mut snapshot = store.read(&command).await.unwrap();
    assert_eq!(snapshot.records.rows.len(), 1); // Only the agent existence check, no global preload.
    let selected = snapshot.select(&command).await.unwrap();
    assert_eq!(selected.items.len(), 1);
    assert!(selected.records.rows.is_empty());
    assert_eq!(selected.items[0], expected["activity"]);
    // Updates committed after read establishment do not change its snapshot.
    let mut unit = store.begin().await.unwrap();
    unit.records.get_mut("events", winner).unwrap().deleted_at = Some(chrono::Utc::now());
    unit.records
        .get_mut("tasks", key(&task))
        .unwrap()
        .archived_at = Some(chrono::Utc::now());
    unit.records
        .get_mut("boards", key(&board))
        .unwrap()
        .archived_at = Some(chrono::Utc::now());
    unit.records
        .get_mut("agents", key(&agent))
        .unwrap()
        .archived_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    assert_eq!(
        snapshot.select(&command).await.unwrap().items[0],
        expected["activity"]
    );
    snapshot.rollback().await.unwrap();
    assert_eq!(
        latest(&app, &agent).await["activity"]["eventId"],
        json!(first)
    );

    let mut unit = store.begin().await.unwrap();
    let summary = unit.records.insert(Record::new(
        "execution_summaries",
        json!({"taskId":id(&task),"actorKind":"agent","actorId":id(&agent)}),
    ));
    let recorded = event(
        &mut unit,
        &task,
        &agent,
        "execution.recorded",
        "2026-11-04T10:00:01Z",
        json!({"executionSummaryId":summary}),
    )
    .await;
    unit.commit().await.unwrap();
    let activity = latest(&app, &agent).await;
    assert_eq!(activity["activity"]["eventId"], json!(recorded));
    assert_eq!(activity["activity"]["summaryId"], json!(summary));
    let mut unit = store.begin().await.unwrap();
    unit.records
        .get_mut("execution_summaries", summary)
        .unwrap()
        .deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    let activity = latest(&app, &agent).await;
    assert_eq!(activity["activity"]["eventId"], json!(recorded));
    assert_eq!(activity["activity"]["summaryId"], Value::Null);
    let mut unit = store.begin().await.unwrap();
    unit.records
        .get_mut("tasks", key(&task))
        .unwrap()
        .deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    assert_eq!(latest(&app, &agent).await, json!({"activity":null}));
    let mut unit = store.begin().await.unwrap();
    unit.records
        .rows
        .get_mut(&("tasks", key(&task)))
        .unwrap()
        .deleted_at = None;
    unit.records
        .get_mut("boards", key(&board))
        .unwrap()
        .deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    assert_eq!(latest(&app, &agent).await, json!({"activity":null}));
    let mut unit = store.begin().await.unwrap();
    unit.records
        .get_mut("agents", key(&agent))
        .unwrap()
        .deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/agents/{}/latest-activity", id(&agent)),
            Value::Null,
            None
        )
        .await
        .0,
        404
    );
}

#[tokio::test]
async fn database_query_failure_is_not_reported_as_no_activity() {
    let (app, pool) = sqlite_app_with_pool().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Connection failure"}),
        None,
    )
    .await;
    // The helper exposes a separate pool on the same isolated file. Break only this fixture.
    sqlx::query("ALTER TABLE events RENAME TO unavailable_events")
        .execute(&pool)
        .await
        .unwrap();
    let (status, body) = request(
        &app,
        "GET",
        &format!("/api/v1/agents/{}/latest-activity", id(&agent)),
        Value::Null,
        None,
    )
    .await;
    assert!(status >= 500, "{status} {body}");
    assert_ne!(body, json!({"activity":null}));
    assert_eq!(tool(&app, &agent).await["result"]["isError"], true);
}

#[tokio::test]
async fn summary_reference_must_belong_to_the_event_task_and_be_explicit() {
    let (app, store, agent, _, board, task) = fixture().await;
    let second=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Another task","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual(),"workScope":test_project_scope()}),None).await;
    let mut unit = store.begin().await.unwrap();
    let summary = unit.records.insert(Record::new(
        "execution_summaries",
        json!({"taskId":id(&second),"actorKind":"agent","actorId":id(&agent)}),
    ));
    let cross = event(
        &mut unit,
        &task,
        &agent,
        "execution.recorded",
        "2026-11-04T10:00:00Z",
        json!({"executionSummaryId":summary}),
    )
    .await;
    unit.commit().await.unwrap();
    let activity = latest(&app, &agent).await;
    assert_eq!(activity["activity"]["eventId"], json!(cross));
    assert_eq!(activity["activity"]["summaryId"], Value::Null);
    let mut unit = store.begin().await.unwrap();
    let unrelated = event(
        &mut unit,
        &second,
        &agent,
        "comment.created",
        "2026-11-04T10:00:01Z",
        json!({"executionSummaryId":summary}),
    )
    .await;
    unit.commit().await.unwrap();
    let activity = latest(&app, &agent).await;
    assert_eq!(activity["activity"]["eventId"], json!(unrelated));
    assert_eq!(activity["activity"]["summaryId"], Value::Null);
}
