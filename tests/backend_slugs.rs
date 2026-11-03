mod support;
use serde_json::json;
use support::*;

#[tokio::test]
async fn slugs_are_stable_concurrent_unique_and_resolve_without_type_ambiguity() {
    let (app, pool) = app_with_pool().await;
    let create = || {
        ok(
            &app,
            "POST",
            "/api/v1/agents",
            json!({"name":"Équipe  Ágil!"}),
            None,
        )
    };
    let (a, b, c) = tokio::join!(create(), create(), create());
    let mut slugs = vec![
        a["slug"].as_str().unwrap(),
        b["slug"].as_str().unwrap(),
        c["slug"].as_str().unwrap(),
    ];
    slugs.sort();
    assert_eq!(slugs, vec!["equipe-agil", "equipe-agil-2", "equipe-agil-3"]);
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Équipe Ágil","leaderId":id(&a),"coordinationContext":manual()}),
        None,
    )
    .await;
    assert_eq!(team["slug"], "equipe-agil");
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Équipe Ágil","teamId":id(&team)}),
        None,
    )
    .await;
    assert!(board.get("slug").is_none());
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Équipe Ágil","workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),None).await;
    assert_eq!(task["slug"], "equipe-agil");
    let child=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Équipe Ágil","parentId":id(&task),"workScope":test_project_scope(),"authorAgentId":id(&a),"executorAgentId":id(&a),"coordinationContext":manual()}),ver(&task)).await;
    assert_eq!(child["slug"], "equipe-agil-2");
    for (kind, entity, field) in [
        ("agents", a.clone(), "name"),
        ("teams", team.clone(), "name"),
        ("tasks", task.clone(), "title"),
    ] {
        let path = format!("/api/v1/{kind}/{}", id(&entity));
        let current = get(&app, &path).await;
        let renamed = ok(
            &app,
            "PATCH",
            &path,
            json!({field:"Renamed"}),
            ver(&current),
        )
        .await;
        assert_eq!(renamed["slug"], entity["slug"]);
        let resolved = get(
            &app,
            &format!(
                "/api/v1/{kind}/by-slug/{}",
                entity["slug"].as_str().unwrap()
            ),
        )
        .await;
        assert_eq!(resolved, json!({"id":id(&entity),"slug":entity["slug"]}));
        assert_eq!(
            request(
                &app,
                "PATCH",
                &path,
                json!({"slug":"replacement"}),
                ver(&renamed)
            )
            .await
            .0,
            400
        );
    }
    let retired_slug = b["slug"].as_str().unwrap();
    sqlx::query("UPDATE agents SET deleted_at=now() WHERE id=$1")
        .bind(uuid::Uuid::parse_str(id(&b)).unwrap())
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/agents/by-slug/{retired_slug}"),
            json!({}),
            None
        )
        .await
        .0,
        404
    );
    let replacement = create().await;
    assert_eq!(replacement["slug"], "equipe-agil-4");
    assert!(sqlx::query("INSERT INTO agents(data) VALUES($1)")
        .bind(json!({"name":"Direct collision","slug":retired_slug}))
        .execute(&pool)
        .await
        .is_err());
    assert!(sqlx::query(
        "UPDATE agents SET data=jsonb_set(data,'{slug}','\"changed\"') WHERE id=$1"
    )
    .bind(uuid::Uuid::parse_str(id(&c)).unwrap())
    .execute(&pool)
    .await
    .is_err());
    let archived = ok(
        &app,
        "PUT",
        &format!("/api/v1/agents/{}/archive", id(&c)),
        json!({"archived":true}),
        ver(&c),
    )
    .await;
    assert_eq!(
        get(
            &app,
            &format!(
                "/api/v1/agents/by-slug/{}",
                archived["slug"].as_str().unwrap()
            )
        )
        .await["id"],
        archived["id"]
    );
    for (name, expected) in [
        ("new", "agent-new"),
        ("🧪", "agent"),
        (
            "10000000-0000-7000-8000-000000000001",
            "agent-10000000-0000-7000-8000-000000000001",
        ),
        ("Ação / Straße Æ Œ", "acao-strasse-ae-oe"),
    ] {
        assert_eq!(
            ok(&app, "POST", "/api/v1/agents", json!({"name":name}), None).await["slug"],
            expected
        );
    }
    for _ in 0..2 {
        let value = ok(
            &app,
            "POST",
            "/api/v1/agents",
            json!({"name":"a".repeat(100)}),
            None,
        )
        .await;
        assert_eq!(value["slug"].as_str().unwrap().len(), 80);
    }
    for slug in ["UPPER", "bad_slug", "missing"] {
        let code = request(
            &app,
            "GET",
            &format!("/api/v1/agents/by-slug/{slug}"),
            json!({}),
            None,
        )
        .await
        .0;
        assert_eq!(code, if slug == "missing" { 404 } else { 400 });
    }
}

#[tokio::test]
async fn slug_backfill_is_ordered_includes_tombstones_and_has_indexed_resolution() {
    let url = std::env::var("BEE_TEST_DATABASE_URL").unwrap();
    let admin = beeteam::db::init_pool(&url).await.unwrap();
    let name = format!("bee_slug_backfill_{}", uuid::Uuid::new_v4().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {name}")))
        .execute(&admin)
        .await
        .unwrap();
    let mut url = url::Url::parse(&url).unwrap();
    url.set_path(&name);
    let pool = beeteam::db::init_pool(url.as_str()).await.unwrap();
    for table in ["agents", "teams", "tasks"] {
        sqlx::raw_sql(sqlx::AssertSqlSafe(format!("CREATE TABLE {table}(id uuid PRIMARY KEY,data jsonb,created_at timestamptz,deleted_at timestamptz)"))).execute(&pool).await.unwrap();
        for n in [3, 1, 2] {
            sqlx::query(sqlx::AssertSqlSafe(format!("INSERT INTO {table} VALUES($1,$2,'2020-01-01',CASE WHEN $3 THEN now() ELSE NULL END)")))
                .bind(uuid::Uuid::parse_str(&format!("10000000-0000-7000-8000-{n:012}")).unwrap())
                .bind(json!({"name":"Ágil","title":"Ágil","specification":"# Keep"})).bind(n==1).execute(&pool).await.unwrap();
        }
    }
    sqlx::raw_sql(include_str!("../migrations/202610270006_entity_slugs.sql"))
        .execute(&pool)
        .await
        .unwrap();
    for table in ["agents", "teams", "tasks"] {
        let slugs: Vec<String> = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
            "SELECT slug FROM {table} ORDER BY id"
        )))
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(slugs, vec!["agil", "agil-2", "agil-3"]);
        let count: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
            "SELECT count(*) FROM {table} WHERE data->>'specification'='# Keep'"
        )))
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 3);
    }
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("SET LOCAL enable_seqscan=off")
        .execute(&mut *tx)
        .await
        .unwrap();
    let plan: Vec<String> = sqlx::query_scalar(
        "EXPLAIN SELECT id,slug FROM agents WHERE slug='agil-2' AND deleted_at IS NULL",
    )
    .fetch_all(&mut *tx)
    .await
    .unwrap();
    assert!(plan.join(" ").contains("agents_slug_unique"));
    tx.rollback().await.unwrap();
}

#[tokio::test]
async fn legacy_agent_replay_adds_canonical_slug_without_rewriting_snapshot() {
    let (app, pool) = app_with_pool().await;
    let body = json!({"name":"Original Name"});
    let original = ok(&app, "POST", "/api/v1/agents", body.clone(), None).await;
    let renamed = ok(
        &app,
        "PATCH",
        &format!("/api/v1/agents/{}", id(&original)),
        json!({"name":"New Name"}),
        ver(&original),
    )
    .await;
    let mut legacy = original.clone();
    legacy.as_object_mut().unwrap().remove("slug");
    let key = uuid::Uuid::new_v4();
    legacy_replay(&pool, "createAgent:{}", key, json!([body, {}, {}]), legacy).await;
    let (code, replayed) = request_key(&app, "POST", "/api/v1/agents", body, None, key).await;
    assert_eq!(code, 201, "{replayed}");
    assert_eq!(replayed["name"], original["name"]);
    assert_eq!(replayed["version"], original["version"]);
    assert_eq!(replayed["slug"], renamed["slug"]);
    assert_eq!(
        get(&app, &format!("/api/v1/agents/{}", id(&original))).await["name"],
        "New Name"
    );
}
