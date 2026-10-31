mod support;
use serde_json::json;
use support::*;

#[tokio::test]
async fn current_summary_is_explicit_persisted_and_independent_of_description() {
    let (app, pool) = app_with_pool().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Author"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Team","leaderId":id(&agent),"coordinationContext":manual()}),
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
    let task = ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Task","description":"Original scope","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    assert_eq!(task["currentSummary"], "");
    assert_eq!(task["specification"], "");
    let path = format!("/api/v1/tasks/{}", id(&task));
    assert_eq!(
        request(
            &app,
            "PATCH",
            &path,
            json!({"progress":{"percent":20,"note":"Not the synthesis"}}),
            ver(&task)
        )
        .await
        .0,
        400
    );
    let summary = "Done: contract. Now: implementation. Next: validation.";
    let task = ok(
        &app,
        "PATCH",
        &path,
        json!({"progress":{"percent":20,"note":"Local note"},"currentSummary":summary}),
        ver(&task),
    )
    .await;
    assert_eq!(task["currentSummary"], summary);
    let task = ok(&app, "PATCH", &path, json!({"title":"Renamed"}), ver(&task)).await;
    assert_eq!(task["currentSummary"], summary);
    assert_eq!(task["description"], "Original scope");
    assert_eq!(get(&app, &path).await["currentSummary"], summary);
    assert_eq!(
        get(&app, &format!("/api/v1/boards/{}/tasks", id(&board))).await["items"][0]
            ["currentSummary"],
        summary
    );
    assert_eq!(
        get(&app, "/api/v1/tasks").await["items"][0]["currentSummary"],
        summary
    );
    for value in [
        json!(null),
        json!(""),
        json!("   "),
        json!("é".repeat(8193)),
    ] {
        assert_eq!(
            request(
                &app,
                "PATCH",
                &path,
                json!({"currentSummary":value}),
                ver(&task)
            )
            .await
            .0,
            400
        );
    }
    let second = "Done: contract and implementation. Now: validation. Next: review.";
    let task = ok(
        &app,
        "PATCH",
        &path,
        json!({"currentSummary":second}),
        ver(&task),
    )
    .await;
    let timeline = get(&app, &format!("{path}/timeline")).await;
    assert!(timeline.to_string().contains(summary));
    assert!(timeline.to_string().contains(second));
    assert_eq!(task["currentSummary"], second);
    let view = get(&app, &format!("/api/v1/boards/{}/view", id(&board))).await;
    assert!(view["columns"]
        .as_array()
        .unwrap()
        .iter()
        .any(|c| c["tasks"]
            .as_array()
            .unwrap()
            .iter()
            .any(|t| t["id"] == task["id"] && t["currentSummary"] == second)));
    let next = ok(
        &app,
        "POST",
        &format!("/api/v1/boards/{}/statuses", id(&board)),
        json!({"name":"Working","isDone":false}),
        ver(&board),
    )
    .await;
    let position = format!("{path}/position");
    assert_eq!(
        request(
            &app,
            "PUT",
            &position,
            json!({"statusId":id(&next),"beforeTaskId":null}),
            ver(&task)
        )
        .await
        .0,
        400
    );
    let third = "Done: implementation. Now: testing in Working. Next: review.";
    let task = ok(
        &app,
        "PUT",
        &position,
        json!({"statusId":id(&next),"beforeTaskId":null,"currentSummary":third}),
        ver(&task),
    )
    .await;
    let task = ok(
        &app,
        "PUT",
        &position,
        json!({"statusId":id(&next),"beforeTaskId":null}),
        ver(&task),
    )
    .await;
    assert_eq!(task["currentSummary"], third);
    let execution = json!({"usageReport":unavailable_usage(),"summary":"Historical activity only","currentSummary":"Done: implementation and testing. Now: review. Next: publish when approved.","outcome":"progress","statusId":id(&next),"deliverables":[],"pending":["Approval"],"executionContext":{"rootTaskId":id(&task),"originBoardId":id(&board)}});
    let mut missing = execution.clone();
    missing.as_object_mut().unwrap().remove("currentSummary");
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{path}/execution-summaries"),
            missing,
            ver(&task)
        )
        .await
        .0,
        400
    );
    let result = ok(
        &app,
        "POST",
        &format!("{path}/execution-summaries"),
        execution.clone(),
        ver(&task),
    )
    .await;
    assert_eq!(
        result["task"]["currentSummary"],
        execution["currentSummary"]
    );
    assert_eq!(
        result["executionSummary"]["summary"],
        "Historical activity only"
    );

    // Replay a pre-upgrade POST snapshot without the newly required input field.
    let mut old_body = execution.clone();
    old_body.as_object_mut().unwrap().remove("currentSummary");
    let mut old_result = result.clone();
    old_result["task"]
        .as_object_mut()
        .unwrap()
        .remove("currentSummary");
    let key = uuid::Uuid::new_v4();
    let params = json!({"taskId":id(&task)});
    legacy_replay(
        &pool,
        &format!("createExecutionSummary:{}", params),
        key,
        json!([old_body, params, {}]),
        old_result,
    )
    .await;
    let before = get(&app, &format!("{path}/timeline")).await;
    let (status, replayed) = request_key(
        &app,
        "POST",
        &format!("{path}/execution-summaries"),
        old_body.clone(),
        ver(&task),
        key,
    )
    .await;
    assert_eq!(status, 201, "{replayed}");
    assert_eq!(replayed["task"]["currentSummary"], "");
    assert_eq!(replayed["task"]["version"], result["task"]["version"]);
    assert_eq!(
        get(&app, &path).await["currentSummary"],
        execution["currentSummary"]
    );
    assert_eq!(get(&app, &format!("{path}/timeline")).await, before);
    assert_eq!(
        request_key(
            &app,
            "POST",
            &format!("{path}/execution-summaries"),
            old_body,
            ver(&result["task"]),
            uuid::Uuid::new_v4()
        )
        .await
        .0,
        400
    );
    let timeline = get(&app, &format!("{path}/timeline")).await.to_string();
    assert!(timeline.contains(second) && timeline.contains(third));
    assert!(timeline.contains(execution["currentSummary"].as_str().unwrap()));
}

#[tokio::test]
async fn backfill_preserves_existing_and_deleted_task_content_without_inference() {
    let pool = beeteam::db::init_pool(&std::env::var("BEE_TEST_DATABASE_URL").unwrap())
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::raw_sql(
        "CREATE TEMP TABLE tasks (id uuid, data jsonb, deleted_at timestamptz) ON COMMIT DROP;",
    )
    .execute(&mut *tx)
    .await
    .unwrap();
    let legacy = json!({"description":"Original scope", "progress":{"note":"Not a synthesis"},"latestExecutionSummaryId":uuid::Uuid::now_v7()});
    let retained = json!({"description":"Existing", "currentSummary":"Explicit synthesis"});
    for (data, deleted) in [
        (legacy.clone(), false),
        (legacy.clone(), true),
        (retained.clone(), false),
    ] {
        sqlx::query("INSERT INTO tasks VALUES ($1,$2,CASE WHEN $3 THEN now() ELSE NULL END)")
            .bind(uuid::Uuid::now_v7())
            .bind(data)
            .bind(deleted)
            .execute(&mut *tx)
            .await
            .unwrap();
    }
    sqlx::raw_sql(include_str!(
        "../migrations/202610270004_task_current_summary.sql"
    ))
    .execute(&mut *tx)
    .await
    .unwrap();
    let rows: Vec<serde_json::Value> = sqlx::query_scalar("SELECT data FROM tasks")
        .fetch_all(&mut *tx)
        .await
        .unwrap();
    assert!(rows.contains(&retained));
    let mut expected = legacy;
    expected["currentSummary"] = json!("");
    assert_eq!(rows.iter().filter(|v| **v == expected).count(), 2);
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM tasks WHERE deleted_at IS NOT NULL")
            .fetch_one(&mut *tx)
            .await
            .unwrap(),
        1
    );
    tx.rollback().await.unwrap();
}

#[test]
fn openapi_examples_remain_valid_after_current_summary_contract_change() {
    fn check(doc: &serde_json::Value, node: &serde_json::Value) {
        if let Some(schema) = node.get("schema") {
            if let Some(example) = node.get("example") {
                beeteam::dto::contracts::validate_schema(doc, schema, example)
                    .unwrap_or_else(|e| panic!("{e}: {example}"));
            }
            if let Some(examples) = node.get("examples").and_then(|v| v.as_object()) {
                for example in examples.values().filter_map(|v| v.get("value")) {
                    beeteam::dto::contracts::validate_schema(doc, schema, example)
                        .unwrap_or_else(|e| panic!("{e}: {example}"));
                }
            }
        }
        match node {
            serde_json::Value::Object(obj) => {
                for value in obj.values() {
                    check(doc, value)
                }
            }
            serde_json::Value::Array(items) => {
                for value in items {
                    check(doc, value)
                }
            }
            _ => {}
        }
    }
    for name in ["getTask", "getAgent"] {
        let op = beeteam::dto::contracts::operation(name).unwrap();
        check(&op.document, &op.document["paths"]);
    }
}
