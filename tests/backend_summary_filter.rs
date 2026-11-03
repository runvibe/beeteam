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
    let r=app.clone().oneshot(Request::post("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"listExecutionSummarys","arguments":{"params":{"taskId":id(task)},"query":query}}}).to_string())).unwrap()).await.unwrap();
    serde_json::from_slice::<Value>(&r.into_body().collect().await.unwrap().to_bytes()).unwrap()
        ["result"]
        .clone()
}
async fn page(app: &Router, task: &Value, query: Value) -> Value {
    let mut url = url::Url::parse(&format!(
        "http://localhost/api/v1/tasks/{}/execution-summaries",
        id(task)
    ))
    .unwrap();
    for (k, v) in query.as_object().unwrap() {
        url.query_pairs_mut().append_pair(
            k,
            &v.as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| v.to_string()),
        );
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
async fn exact_summary_id_filters_before_count_and_pagination_with_transport_parity() {
    let dir = tempfile::tempdir().unwrap();
    let url = format!(
        "sqlite://{}",
        dir.path()
            .join("summary-filter.sqlite")
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
        json!({"name":"Summary filter fixture"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Summary filters","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Summary filters","teamId":id(&team)}),
        None,
    )
    .await;
    let mut tasks = Vec::new();
    for name in ["A", "B"] {
        tasks.push(ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":name,"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await);
    }
    let mut task = tasks.remove(0);
    let other = tasks.remove(0);
    let mut summaries = Vec::new();
    for n in 0..4 {
        let body = json!({"commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(id(&agent)),"summary":format!("Summary {n}"),"currentSummary":"Cumulative fixture synthesis","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&task),"originBoardId":id(&board)}});
        let result = ok(
            &app,
            "POST",
            &format!("/api/v1/tasks/{}/execution-summaries", id(&task)),
            body,
            ver(&task),
        )
        .await;
        task = result["task"].clone();
        summaries.push(result["executionSummary"].clone());
    }
    let first = page(&app, &task, json!({"limit":1})).await;
    assert_eq!(first["total"], 4);
    assert_eq!(first["items"][0]["id"], summaries[0]["id"]);
    let selected = &summaries[3];
    let exact = page(
        &app,
        &task,
        json!({"id":id(selected).to_uppercase(),"limit":1}),
    )
    .await;
    assert_eq!(exact["total"], 1);
    assert_eq!(exact["items"][0]["id"], selected["id"]);
    assert_eq!(exact["hasMore"], false);
    let beyond = page(&app, &task, json!({"id":id(selected),"limit":1,"offset":1})).await;
    assert_eq!(beyond["total"], 1);
    assert!(beyond["items"].as_array().unwrap().is_empty());
    for query in [
        json!({"id":uuid::Uuid::now_v7()}),
        json!({"id":id(selected),"outcome":"completed"}),
        json!({"id":id(selected),"createdBefore":"2000-01-01T00:00:00Z"}),
    ] {
        let p = page(&app, &task, query).await;
        assert_eq!(p["total"], 0);
        assert!(p["items"].as_array().unwrap().is_empty());
    }
    assert_eq!(
        page(&app, &other, json!({"id":id(selected)})).await["total"],
        0
    );
    for invalid in ["not-a-uuid".to_owned(), uuid::Uuid::new_v4().to_string()] {
        let (status, _) = request(
            &app,
            "GET",
            &format!(
                "/api/v1/tasks/{}/execution-summaries?id={invalid}",
                id(&task)
            ),
            Value::Null,
            None,
        )
        .await;
        assert_eq!(status, 400);
        assert_eq!(
            tool(&app, &task, json!({"id":invalid})).await["isError"],
            true
        );
    }
    // Only this temporary fixture is tombstoned; real summaries and product data are untouched.
    let mut unit = store.begin().await.unwrap();
    let record = unit
        .records
        .get_mut(
            "execution_summaries",
            uuid::Uuid::parse_str(id(selected)).unwrap(),
        )
        .unwrap();
    record.deleted_at = Some(chrono::Utc::now());
    record.touch();
    unit.commit().await.unwrap();
    assert_eq!(
        page(&app, &task, json!({"id":id(selected)})).await["total"],
        0
    );
    assert_eq!(page(&app, &task, json!({"limit":1})).await["total"], 3);
}
