#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig, DEFAULT_MCP_PATH},
    repositories::database::DatabaseRepository,
    routes::create_router,
    state::AppState,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;
async fn tool(app: &Router, task: &Value, query: Value) -> Value {
    let response=app.clone().oneshot(Request::post("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"getTimeline","arguments":{"params":{"taskId":id(task)},"query":query}}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice::<Value>(&response.into_body().collect().await.unwrap().to_bytes())
        .unwrap()["result"]
        .clone()
}
async fn page(app: &Router, task: &Value, query: Value) -> Value {
    let mut url = url::Url::parse(&format!(
        "http://localhost/api/v1/tasks/{}/timeline",
        id(task)
    ))
    .unwrap();
    for (key, value) in query.as_object().unwrap() {
        let text = match value {
            Value::String(s) => s.clone(),
            Value::Array(items) => items
                .iter()
                .map(|v| v.as_str().unwrap())
                .collect::<Vec<_>>()
                .join(","),
            _ => value.to_string(),
        };
        url.query_pairs_mut().append_pair(key, &text);
    }
    let http = get(
        app,
        &format!("{}?{}", url.path(), url.query().unwrap_or("")),
    )
    .await;
    let mcp = tool(app, task, query).await;
    assert_eq!(mcp["isError"], false, "{mcp}");
    assert_eq!(mcp["structuredContent"]["data"], http);
    http
}
#[tokio::test]
async fn exact_timeline_event_filters_before_count_and_pagination_and_respects_recursive_scope() {
    let dir = tempfile::tempdir().unwrap();
    let url = format!(
        "sqlite://{}",
        dir.path()
            .join("timeline.sqlite")
            .to_string_lossy()
            .replace('\\', "/")
    );
    let db = DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
        .await
        .unwrap();
    let (store, _) = db.stores();
    let config = AppConfig {
        database_driver: DatabaseDriver::Sqlite,
        database_url: url,
        host: "127.0.0.1".parse().unwrap(),
        port: 0,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 22 * 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig {
            enabled: true,
            path: DEFAULT_MCP_PATH.into(),
            cors: CorsConfig::Permissive,
        },
    };
    let app = create_router(AppState::new(db), &config);
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Timeline fixture"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Timeline fixture","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let mut boards = vec![];
    for name in ["Root board", "Cross board"] {
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
    let body = |title: &str, parent: Value| json!({"title":title,"parentId":parent,"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual(),"workScope":test_project_scope()});
    let root = ok(
        &app,
        "POST",
        &format!("/api/v1/boards/{}/tasks", id(&boards[0])),
        body("Root", Value::Null),
        None,
    )
    .await;
    let child = ok(
        &app,
        "POST",
        &format!("/api/v1/boards/{}/tasks", id(&boards[1])),
        body("Child", root["id"].clone()),
        ver(&root),
    )
    .await;
    let grandchild = ok(
        &app,
        "POST",
        &format!("/api/v1/boards/{}/tasks", id(&boards[0])),
        body("Grandchild", child["id"].clone()),
        ver(&child),
    )
    .await;
    let other = ok(
        &app,
        "POST",
        &format!("/api/v1/boards/{}/tasks", id(&boards[0])),
        body("Unrelated", Value::Null),
        None,
    )
    .await;
    let task_path = format!("/api/v1/tasks/{}", id(&root));
    let mut current = get(&app, &task_path).await;
    for n in 0..55 {
        ok(
            &app,
            "POST",
            &format!("{task_path}/comments"),
            json!({"body":format!("Timeline event {n}")}),
            ver(&current),
        )
        .await;
        current = get(&app, &task_path).await;
    }
    let all = page(&app, &root, json!({"limit":100})).await;
    let first = page(&app, &root, json!({"limit":50})).await;
    assert!(all["total"].as_u64().unwrap() > 50);
    assert_eq!(first["total"], all["total"]);
    assert_eq!(first["items"].as_array().unwrap().len(), 50);
    let selected = all["items"].as_array().unwrap().last().unwrap();
    assert!(!first["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["id"] == selected["id"]));
    let exact = page(
        &app,
        &root,
        json!({"id":id(selected).to_uppercase(),"limit":1}),
    )
    .await;
    assert_eq!(exact["total"], 1);
    assert_eq!(exact["items"], json!([selected]));
    assert_eq!(exact["hasMore"], false);
    assert!(exact["nextOffset"].is_null());
    let beyond = page(&app, &root, json!({"id":id(selected),"offset":1,"limit":1})).await;
    assert_eq!(beyond["total"], 1);
    assert_eq!(beyond["items"], json!([]));
    assert_eq!(beyond["hasMore"], false);
    let combined = page(
        &app,
        &root,
        json!({"id":id(selected),"types":[selected["type"].clone()],"sortOrder":"desc"}),
    )
    .await;
    assert_eq!(combined["items"], json!([selected]));
    for query in [
        json!({"id":uuid::Uuid::now_v7()}),
        json!({"id":id(selected),"types":["task.created"]}),
        json!({"id":id(selected),"actorId":id(&agent)}),
        json!({"id":id(selected),"occurredBefore":"2000-01-01T00:00:00Z"}),
    ] {
        let empty = page(&app, &root, query).await;
        assert_eq!(empty["total"], 0);
        assert_eq!(empty["items"], json!([]));
    }
    for descendant in [&child, &grandchild] {
        let child_events = page(&app, descendant, json!({})).await;
        let event = &child_events["items"][0];
        for include in [false, true] {
            let result = page(
                &app,
                &root,
                json!({"id":id(event),"includeChildren":include}),
            )
            .await;
            assert_eq!(result["total"], if include { 1 } else { 0 });
            if include {
                assert_eq!(result["items"], json!([event]));
            }
        }
        assert_eq!(
            page(&app, &other, json!({"id":id(event),"includeChildren":true})).await["total"],
            0
        );
    }
    let other_event = page(&app, &other, json!({})).await["items"][0].clone();
    assert_eq!(
        page(
            &app,
            &root,
            json!({"id":id(&other_event),"includeChildren":true})
        )
        .await["total"],
        0
    );
    assert_eq!(
        page(
            &app,
            &child,
            json!({"id":id(selected),"includeChildren":true})
        )
        .await["total"],
        0
    );
    for invalid in ["invalid".to_owned(), uuid::Uuid::new_v4().to_string()] {
        assert_eq!(
            request(
                &app,
                "GET",
                &format!("{task_path}/timeline?id={invalid}"),
                Value::Null,
                None
            )
            .await
            .0,
            400
        );
        assert_eq!(
            tool(&app, &root, json!({"id":invalid})).await["isError"],
            true
        );
    }
    assert_eq!(
        request(
            &app,
            "GET",
            &format!(
                "{task_path}/timeline?id={}&id={}",
                id(selected),
                id(selected)
            ),
            Value::Null,
            None
        )
        .await
        .0,
        400
    );
    assert_eq!(
        tool(&app, &root, json!({"id":[id(selected),id(selected)]})).await["isError"],
        true
    );
    // Tombstone only the isolated fixture to ensure IDs cannot bypass deletion scope.
    let mut unit = store.begin().await.unwrap();
    let event = unit
        .records
        .get_mut("events", uuid::Uuid::parse_str(id(selected)).unwrap())
        .unwrap();
    event.deleted_at = Some(chrono::Utc::now());
    event.touch();
    unit.commit().await.unwrap();
    assert_eq!(
        page(&app, &root, json!({"id":id(selected)})).await["total"],
        0
    );
    assert_eq!(
        page(&app, &root, json!({})).await["total"].as_u64(),
        Some(all["total"].as_u64().unwrap() - 1)
    );
}
#[test]
fn timeline_id_is_optional_uuidv7_in_the_shared_http_and_mcp_contract() {
    let catalog = beeteam::routes::mcp::catalog();
    let tool = catalog["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["name"] == "getTimeline")
        .unwrap();
    let schema = &tool["inputSchema"]["properties"]["query"];
    assert_eq!(schema["properties"]["id"]["format"], "uuid");
    assert!(schema["properties"]["id"]["pattern"]
        .as_str()
        .unwrap()
        .contains("-7"));
    assert!(!schema["required"]
        .as_array()
        .is_some_and(|fields| fields.iter().any(|f| f == "id")));
}
