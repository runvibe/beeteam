mod support;
use serde_json::json;
use support::*;

#[tokio::test]
async fn concurrent_versions_and_role_changes_are_atomic() {
    let app = app().await;
    let a = ok(&app, "POST", "/api/v1/agents", json!({"name":"A"}), None).await;
    let b = ok(&app, "POST", "/api/v1/agents", json!({"name":"B"}), None).await;
    let c = ok(&app, "POST", "/api/v1/agents", json!({"name":"C"}), None).await;
    let path = format!("/api/v1/agents/{}", id(&a));
    let (left, right) = tokio::join!(
        request(&app, "PATCH", &path, json!({"name":"Left"}), ver(&a)),
        request(&app, "PATCH", &path, json!({"name":"Right"}), ver(&a))
    );
    let mut results = vec![left.0, right.0];
    results.sort();
    assert_eq!(results, vec![200, 412]);
    let t1=ok(&app,"POST","/api/v1/teams",json!({"name":"T1","leaderId":id(&a),"collaboratorIds":[id(&c)],"coordinationContext":manual()}),None).await;
    let t2 = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"T2","leaderId":id(&b),"coordinationContext":manual()}),
        None,
    )
    .await;
    let bad = json!({"teams":[{"teamId":id(&t2),"expectedVersion":t2["version"],"leaderId":id(&b),"collaboratorIds":[id(&c)]}],"coordinationContext":manual()});
    assert_eq!(
        request(&app, "POST", "/api/v1/team-composition-changes", bad, None)
            .await
            .0,
        409
    );
    assert_eq!(
        get(&app, &format!("/api/v1/teams/{}", id(&t2))).await["version"],
        t2["version"]
    );
    let swap = json!({"teams":[{"teamId":id(&t1),"expectedVersion":t1["version"],"leaderId":id(&b),"collaboratorIds":[]},{"teamId":id(&t2),"expectedVersion":t2["version"],"leaderId":id(&a),"collaboratorIds":[id(&c)]}],"coordinationContext":manual()});
    ok(&app, "POST", "/api/v1/team-composition-changes", swap, None).await;
    assert_eq!(
        get(&app, &format!("/api/v1/agents/{}", id(&a))).await["bindings"]["leaderTeamId"],
        t2["id"]
    );
    let t1 = get(&app, &format!("/api/v1/teams/{}", id(&t1))).await;
    let bad = json!({"teams":[{"teamId":id(&t1),"expectedVersion":t1["version"],"leaderId":id(&b),"collaboratorIds":[id(&b)]}],"coordinationContext":manual()});
    assert_eq!(
        request(&app, "POST", "/api/v1/team-composition-changes", bad, None)
            .await
            .0,
        409
    );
}

#[tokio::test]
async fn deep_cross_board_chain_uses_current_origin_and_invalidates_versions() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Deep chain"}),
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
    let origin = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Origin","teamId":id(&team),"autonomyMode":"automatic"}),
        None,
    )
    .await;
    let destination = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Destination","teamId":id(&team),"autonomyMode":"manual"}),
        None,
    )
    .await;
    let root=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&origin)),json!({"title":"Root","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":automatic()}),None).await;
    let mut parent = root.clone();
    for depth in 1..=32 {
        parent=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",if depth%2==0{id(&origin)}else{id(&destination)}),json!({"title":format!("Level {depth}"),"parentId":id(&parent),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"autonomyMode":"manual","coordinationContext":automatic()}),ver(&parent)).await;
    }
    assert_eq!(parent["executionContext"]["rootTaskId"], root["id"]);
    let before = parent["version"].as_i64().unwrap();
    ok(
        &app,
        "PATCH",
        &format!("/api/v1/boards/{}", id(&origin)),
        json!({"autonomyMode":"standard"}),
        ver(&origin),
    )
    .await;
    let leaf = get(&app, &format!("/api/v1/tasks/{}", id(&parent))).await;
    assert_eq!(leaf["executionContext"]["effectiveMode"], "manual");
    assert!(
        leaf["version"].as_i64().unwrap() > before,
        "Derived execution context changed; invalidate task ETag"
    );
    let timeline = get(
        &app,
        &format!(
            "/api/v1/tasks/{}/timeline?includeChildren=true&limit=100",
            id(&root)
        ),
    )
    .await;
    assert_eq!(timeline["total"], 33);
    assert_eq!(
        request(
            &app,
            "PATCH",
            &format!("/api/v1/tasks/{}", id(&root)),
            json!({"parentId":id(&leaf)}),
            Some(1)
        )
        .await
        .0,
        400
    );
}
