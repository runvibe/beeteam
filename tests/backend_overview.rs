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
    let current = get(app, &format!("/api/v2/tasks/{}", id(task))).await;
    success(app,name,json!({"params":{"taskId":id(task)},"actor":actor,"expectedVersion":current["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":body})).await
}
#[tokio::test]
async fn overview_uses_complete_direct_children_and_only_recorded_bounded_history() {
    let app = app().await;
    let a = ok(&app, "POST", "/api/v2/agents", json!({"name":"A"}), None).await;
    let b = ok(&app, "POST", "/api/v2/agents", json!({"name":"B"}), None).await;
    let actor_a = json!({"kind":"agent","id":id(&a)});
    let actor_b = json!({"kind":"agent","id":id(&b)});
    let team = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"Overview","leaderId":id(&a),"coordinationContext":manual()}),
        None,
    )
    .await;
    let mut boards = Vec::new();
    let mut statuses = Vec::new();
    for name in ["First board", "Second board"] {
        let board=ok(&app,"POST","/api/v2/boards",json!({"name":name,"teamId":id(&team),"statuses":[{"name":"Open","isDone":false},{"name":"Done","isDone":true}]}),None).await;
        statuses.push(
            get(&app, &format!("/api/v2/boards/{}/statuses", id(&board))).await["items"].clone(),
        );
        boards.push(board);
    }
    let root=ok(&app,"POST",&format!("/api/v2/boards/{}/tasks",id(&boards[0])),json!({"title":"Root","workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),None).await;
    let path = format!("/api/v2/tasks/{}/overview", id(&root));
    let empty = get(&app, &path).await;
    assert_eq!(empty["directSubtasks"]["total"], 0);
    assert_eq!(empty["progressHistory"]["items"], json!([]));
    assert!(empty["currentSummaryMeta"].is_null());
    assert!(empty["latestExecutionSummary"].is_null());
    assert!(empty["nextStep"].is_null());
    assert_eq!(empty["decisions"], json!([]));
    let mut children = Vec::new();
    for i in 0..55 {
        let board_index = i % 2;
        let current = get(&app, &format!("/api/v2/tasks/{}", id(&root))).await;
        let child=ok(&app,"POST",&format!("/api/v2/boards/{}/tasks",id(&boards[board_index])),json!({"title":format!("Child {i}"),"parentId":id(&root),"workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":if board_index==0{id(&a)}else{id(&b)},"coordinationContext":manual()}),ver(&current)).await;
        if i < 5 {
            let done = statuses[board_index]
                .as_array()
                .unwrap()
                .iter()
                .find(|s| s["isDone"] == true)
                .unwrap();
            mutation(&app,&child,&actor_a,"createExecutionSummary",json!({"currentSummary":"Child done","commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(root["executorAgentId"].as_str().unwrap()),"summary":"Test closure","outcome":"completed","statusId":done["id"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&root),"originBoardId":id(&boards[0])}})).await;
        }
        if i >= 10 && i % 10 == 0 {
            mutation(
                &app,
                &child,
                &actor_b,
                "blockTask",
                json!({"blocked":true,"reason":"Recorded block"}),
            )
            .await;
        }
        if i == 54 {
            mutation(
                &app,
                &child,
                &actor_a,
                "archiveTask",
                json!({"archived":true}),
            )
            .await;
        }
        children.push(child);
    }
    let parent = get(&app, &format!("/api/v2/tasks/{}", id(&children[6]))).await;
    ok(&app,"POST",&format!("/api/v2/boards/{}/tasks",id(&boards[0])),json!({"title":"Grandchild excluded","parentId":id(&parent),"workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),ver(&parent)).await;
    ok(&app,"POST",&format!("/api/v2/boards/{}/tasks",id(&boards[0])),json!({"title":"Unrelated excluded","workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&b),"coordinationContext":manual()}),None).await;
    for i in 0..102 {
        mutation(&app,&root,&actor_b,"updateTask",json!({"currentSummary":format!("Explicit synthesis {i}"),"progress":{"percent":i%101,"note":format!("Point {i}")}})).await;
    }
    mutation(&app,&root,&actor_b,"updateTask",json!({"currentSummary":"Explicit final point","progress":{"percent":37,"note":"Recorded 37"}})).await;
    let deliveries:Vec<Value>=(0..12).map(|i|json!({"label":format!("Recorded delivery {i}"),"url":format!("https://example.com/delivery/{i}")})).collect();
    let earlier=mutation(&app,&root,&actor_a,"createExecutionSummary",json!({"currentSummary":"Prior summary","commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(root["executorAgentId"].as_str().unwrap()),"summary":"Earlier report","outcome":"progress","statusId":root["statusId"],"deliverables":deliveries,"pending":["Earlier pending"],"executionContext":{"rootTaskId":id(&root),"originBoardId":id(&boards[0])}})).await;
    let latest=mutation(&app,&root,&actor_a,"createExecutionSummary",json!({"currentSummary":"Latest synthesis","commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(root["executorAgentId"].as_str().unwrap()),"summary":"Latest report","outcome":"progress","statusId":root["statusId"],"progress":{"percent":88,"note":"Closure progress not stored in legacy event"},"deliverables":[],"pending":["Recorded pending"],"executionContext":{"rootTaskId":id(&root),"originBoardId":id(&boards[0])}})).await;
    mutation(
        &app,
        &root,
        &actor_a,
        "blockTask",
        json!({"blocked":true,"reason":"Root block"}),
    )
    .await;
    for i in 0..6 {
        let current = get(&app, &format!("/api/v2/tasks/{}", id(&root))).await;
        success(&app,"createAttachment",json!({"params":{"taskId":id(&root)},"actor":actor_b,"expectedVersion":current["version"],"idempotencyKey":uuid::Uuid::new_v4(),"body":{"description":"Test only"},"upload":{"name":format!("file-{i}.txt"),"mediaType":"text/plain","dataBase64":"dGVzdA=="}})).await;
    }
    let children_path = format!("/api/v2/tasks?parentId={}", id(&root));
    assert_eq!(get(&app, &children_path).await["total"], 54);
    let all = get(&app, &format!("{children_path}&includeArchived=true")).await;
    assert_eq!(all["total"], 55);
    assert_eq!(
        success(
            &app,
            "listAllTasks",
            json!({"query":{"parentId":id(&root),"includeArchived":true}})
        )
        .await["data"],
        all
    );
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("{children_path}&includeArchived=true&archived=false"),
            json!({}),
            None
        )
        .await
        .0,
        400
    );
    let before = get(&app, &format!("/api/v2/tasks/{}", id(&root))).await;
    let view = get(&app, &path).await;
    let mcp = success(
        &app,
        "getTaskOverview",
        json!({"params":{"taskId":id(&root)}}),
    )
    .await;
    assert_eq!(mcp["data"], view);
    let catalog = beeteam::routes::mcp::catalog();
    let schema = &catalog["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["name"] == "getTaskOverview")
        .unwrap()["outputSchema"];
    jsonschema::validator_for(schema)
        .unwrap()
        .validate(&mcp)
        .unwrap();
    assert_eq!(view["task"], before);
    let direct = &view["directSubtasks"];
    assert_eq!(direct["total"], 55);
    assert_eq!(direct["done"], 5);
    assert_eq!(direct["remaining"], 50);
    assert_eq!(direct["blocked"], 5);
    assert_eq!(direct["archivedIncluded"], true);
    assert_eq!(
        direct["byStatus"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["total"].as_u64().unwrap())
            .sum::<u64>(),
        55
    );
    assert_eq!(direct["byStatus"].as_array().unwrap().len(), 4);
    assert!(direct["byStatus"]
        .as_array()
        .unwrap()
        .iter()
        .all(|v| v["color"].is_null() && v["boardName"].is_string()));
    assert_eq!(direct["byExecutor"].as_array().unwrap().len(), 2);
    assert_eq!(
        direct["byExecutor"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v["done"].as_u64().unwrap())
            .sum::<u64>(),
        5
    );
    assert_eq!(view["task"]["progress"]["percent"], 88);
    assert_eq!(view["task"]["childSummary"], json!({"total":55,"done":5}));
    let history = &view["progressHistory"];
    assert_eq!(history["total"], 105);
    assert_eq!(history["items"].as_array().unwrap().len(), 100);
    assert_eq!(history["truncated"], true);
    assert_eq!(history["items"][99]["summaryId"], latest["data"]["executionSummary"]["id"]);
    assert_eq!(history["items"][98]["summaryId"], earlier["data"]["executionSummary"]["id"]);
    assert!(history["items"][0]["summaryId"].is_null());
    assert_eq!(history["items"][99]["percent"], 88);
    assert_eq!(history["items"][0]["note"], "Point 5");
    assert!(history["items"][0]["occurredAt"].is_string());
    assert_eq!(history["items"][0]["actorId"], b["id"]);
    assert_eq!(view["currentSummaryMeta"]["actorId"], a["id"]);
    assert!(view["currentSummaryMeta"]["eventId"].is_string());
    // Compare persisted reads: PostgreSQL timestamps have microsecond precision.
    let persisted = get(&app, &format!("/api/v2/tasks/{}/execution-summaries", id(&root))).await;
    let latest_persisted = persisted["items"].as_array().unwrap().iter()
        .find(|row| row["id"] == latest["data"]["executionSummary"]["id"]).unwrap();
    assert_eq!(&view["latestExecutionSummary"], latest_persisted);
    assert_eq!(
        view["latestExecutionSummary"]["pending"],
        json!(["Recorded pending"])
    );
    assert_eq!(view["latestDeliverables"]["total"], 12);
    assert_eq!(
        view["latestDeliverables"]["items"]
            .as_array()
            .unwrap()
            .len(),
        10
    );
    assert_eq!(view["latestDeliverables"]["truncated"], true);
    assert_eq!(
        view["latestDeliverables"]["items"][0]["summaryId"],
        earlier["data"]["executionSummary"]["id"]
    );
    assert_eq!(view["latestAttachments"]["total"], 6);
    assert_eq!(
        view["latestAttachments"]["items"].as_array().unwrap().len(),
        5
    );
    assert_eq!(view["latestAttachments"]["truncated"], true);
    assert_eq!(view["recentEvents"]["items"].as_array().unwrap().len(), 20);
    assert_eq!(view["recentEvents"]["truncated"], true);
    assert!(view["nextStep"].is_null());
    assert_eq!(view["decisions"], json!([]));
    assert_eq!(
        get(&app, &format!("/api/v2/tasks/{}", id(&root))).await,
        before
    );
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v2/tasks/{}/overview", uuid::Uuid::now_v7()),
            json!({}),
            None
        )
        .await
        .0,
        404
    );
    assert_eq!(
        request(&app, "GET", &format!("{path}?limit=1"), json!({}), None)
            .await
            .0,
        400
    );
}

#[tokio::test]
async fn overview_sql_aggregates_keep_one_snapshot_without_hydrating_children() {
    use beeteam::{
        config::DatabaseDriver,
        dto::backend::{Actor, Command},
        repositories::database::DatabaseRepository,
        services::backend::service::BackendService,
    };
    use std::collections::BTreeMap;
    let temp = tempfile::tempdir().unwrap();
    let url = format!(
        "sqlite://{}",
        temp.path()
            .join("overview.sqlite")
            .to_string_lossy()
            .replace('\\', "/")
    );
    let database = DatabaseRepository::connect(DatabaseDriver::Sqlite, &url)
            .await
            .unwrap();
    let (repository, _) = database.stores();
    let service = BackendService::new(repository.clone(), std::sync::Arc::new(beeteam::repositories::local_git::LocalGitDiscovery::default()));
    let command = |operation: &str,
                   params: BTreeMap<String, String>,
                   body: Value,
                   version: Option<i64>| Command {
        operation: operation.into(),
        params,
        query: BTreeMap::new(),
        body,
        actor: Some(Actor {
            kind: "human".into(),
            id: None,
        }),
        expected_version: version,
        idempotency_key: Some(uuid::Uuid::new_v4()),
        upload: None,
    };
    let agent = service
        .execute(command(
            "createAgent",
            BTreeMap::new(),
            json!({"name":"Snapshot"}),
            None,
        ))
        .await
        .unwrap()
        .data;
    let team = service
        .execute(command(
            "createTeam",
            BTreeMap::new(),
            json!({"name":"Snapshot","leaderId":id(&agent),"coordinationContext":manual()}),
            None,
        ))
        .await
        .unwrap()
        .data;
    let board = service
        .execute(command(
            "createBoard",
            BTreeMap::new(),
            json!({"name":"Snapshot","teamId":id(&team)}),
            None,
        ))
        .await
        .unwrap()
        .data;
    let root=service.execute(command("createTask",BTreeMap::from([("boardId".into(),id(&board).into())]),json!({"title":"Root","workScope":test_project_scope(),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None)).await.unwrap().data;
    let read = command(
        "getTaskOverview",
        BTreeMap::from([("taskId".into(), id(&root).into())]),
        json!({}),
        None,
    );
    let mut snapshot = repository.read(&read).await.unwrap();
    service.execute(command("createTask",BTreeMap::from([("boardId".into(),id(&board).into())]),json!({"title":"Concurrent child","parentId":id(&root),"workScope":test_project_scope(),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),ver(&root))).await.unwrap();
    assert_eq!(snapshot.records.list("tasks").len(), 1);
    assert_eq!(
        snapshot.select(&read).await.unwrap().items[0]["directSubtasks"]["total"],
        0
    );
    let fresh = service.execute(read.clone()).await.unwrap().data;
    assert_eq!(fresh["directSubtasks"]["total"], 1);
    assert_eq!(fresh["task"]["childSummary"]["total"], 1);
    let new_snapshot = repository.read(&read).await.unwrap();
    assert_eq!(
        new_snapshot.records.list("tasks").len(),
        1,
        "Overview must not preload child bodies"
    );
}
