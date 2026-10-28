mod support;
use serde_json::json;
use support::*;

#[tokio::test]
async fn markdown_specification_and_plan_revisions_preserve_independent_text() {
    let app = app().await;
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
    let markdown="# Entrega\r\n\r\n- [ ] Aceite **verificado**\r\n\r\n```rust\r\nlet x = \"ação\";\r\n```\r\n\r\n<script>not executed</script>\r\n";
    let mut task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Task","description":"Short presentation","specification":markdown,"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    let path = format!("/api/v1/tasks/{}", id(&task));
    assert_eq!(task["specification"], markdown);
    assert_eq!(task["currentSummary"], "");
    let revised = format!("{markdown}\n## Regras\nSem execução de HTML.\n");
    task = ok(
        &app,
        "PATCH",
        &path,
        json!({"specification":revised}),
        ver(&task),
    )
    .await;
    assert_eq!(task["specification"], revised);
    assert_eq!(task["currentSummary"], "");
    assert_eq!(task["description"], "Short presentation");
    assert_eq!(get(&app, &path).await["specification"], revised);
    assert_eq!(
        get(&app, "/api/v1/tasks").await["items"][0]["specification"],
        revised
    );
    for value in [json!(null), json!(42), json!("é".repeat(32769))] {
        assert_eq!(
            request(
                &app,
                "PATCH",
                &path,
                json!({"specification":value}),
                ver(&task)
            )
            .await
            .0,
            400
        );
    }
    task = get(&app, &path).await;
    let before = get(&app, &format!("{path}/timeline")).await;
    assert_eq!(request(&app,"PATCH",&path,json!({"specification":"Must rollback","progress":{"percent":20,"note":"Missing synthesis"}}),ver(&task)).await.0,400);
    assert_eq!(get(&app, &format!("{path}/timeline")).await, before);
    assert_eq!(get(&app, &path).await, task);
    let plan = ok(
        &app,
        "POST",
        &format!("{path}/plans"),
        json!({"title":"Execution plan","content":markdown}),
        ver(&task),
    )
    .await;
    assert_eq!(plan["content"], markdown);
    task = get(&app, &path).await;
    let revision = ok(
        &app,
        "POST",
        &format!(
            "{path}/plans/{}/revisions",
            plan["planId"].as_str().unwrap()
        ),
        json!({"baseRevision":1,"content":revised,"changeSummary":"Added rules"}),
        ver(&task),
    )
    .await;
    assert_eq!(revision["content"], revised);
    let revisions = get(
        &app,
        &format!(
            "{path}/plans/{}/revisions",
            plan["planId"].as_str().unwrap()
        ),
    )
    .await;
    assert!(revisions["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|p| p["content"] == markdown));
    task = get(&app, &path).await;
    assert_eq!(task["specification"], revised);
    task = ok(
        &app,
        "PATCH",
        &path,
        json!({"specification":"é".repeat(32768)}),
        ver(&task),
    )
    .await;
    assert_eq!(task["specification"].as_str().unwrap().len(), 65536);
    task = ok(
        &app,
        "PATCH",
        &path,
        json!({"specification":""}),
        ver(&task),
    )
    .await;
    assert_eq!(task["specification"], "");
    let events = get(&app, &format!("{path}/timeline")).await;
    assert!(events["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|e| e["data"]["previous"]["specification"] == markdown
            && e["data"]["changes"]["specification"] == revised));
}

#[tokio::test]
async fn specification_backfill_retains_markdown_and_tombstones() {
    let pool = beeteam::db::init_pool(&std::env::var("BEE_TEST_DATABASE_URL").unwrap())
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::raw_sql("CREATE TEMP TABLE tasks(data jsonb,deleted_at timestamptz) ON COMMIT DROP")
        .execute(&mut *tx)
        .await
        .unwrap();
    let legacy = json!({"description":"Do not infer","currentSummary":"Done"});
    let existing = json!({"specification":"# Existing\r\n- **Keep**\r\n"});
    for data in [legacy.clone(), existing.clone()] {
        sqlx::query("INSERT INTO tasks VALUES($1,now())")
            .bind(data)
            .execute(&mut *tx)
            .await
            .unwrap();
    }
    sqlx::raw_sql(include_str!(
        "../migrations/202610270005_task_specification.sql"
    ))
    .execute(&mut *tx)
    .await
    .unwrap();
    let rows: Vec<serde_json::Value> = sqlx::query_scalar("SELECT data FROM tasks")
        .fetch_all(&mut *tx)
        .await
        .unwrap();
    let mut expected = legacy;
    expected["specification"] = json!("");
    assert!(rows.contains(&expected) && rows.contains(&existing));
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM tasks WHERE deleted_at IS NOT NULL")
            .fetch_one(&mut *tx)
            .await
            .unwrap(),
        2
    );
    tx.rollback().await.unwrap();
}
