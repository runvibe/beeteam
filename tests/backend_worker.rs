mod support;
use serde_json::json;
use support::*;

#[tokio::test]
async fn worker_contract_and_legacy_facade_preserve_membership_and_replays() {
    let app = app().await;
    let leader = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Leader"}),
        None,
    )
    .await;
    let worker = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"collaborator text stays"}),
        None,
    )
    .await;
    let key = uuid::Uuid::new_v4();
    let old = json!({"name":"Team","leaderId":id(&leader),"collaboratorIds":[id(&worker)],"collaboratorIconId":"lightbulb","coordinationContext":manual()});
    let (status, legacy) = request_key(&app, "POST", "/api/v1/teams", old.clone(), None, key).await;
    assert_eq!(status, 201, "{legacy}");
    let canonical = get(&app, &format!("/api/v2/teams/{}", id(&legacy))).await;
    assert_eq!(canonical["workerIconId"], "lightbulb");
    assert_eq!(canonical["workerCount"], 1);
    assert!(canonical.get("collaboratorIconId").is_none());
    assert_eq!(canonical["roleIcons"]["worker"]["id"], "lightbulb");
    let mut replay_snapshot = legacy.clone();
    beeteam::dto::worker_contract::response(beeteam::dto::contracts::operation("createTeam").unwrap(), &mut replay_snapshot, false).unwrap();
    let new = json!({"name":"Team","leaderId":id(&leader),"workerIds":[id(&worker)],"workerIconId":"lightbulb","coordinationContext":manual()});
    assert_eq!(
        request_key(&app, "POST", "/api/v2/teams", new, None, key).await,
        (201, replay_snapshot)
    );
    assert_eq!(
        request_key(&app, "POST", "/api/v1/teams", old, None, key).await,
        (201, legacy.clone())
    );
    let agent = get(&app, &format!("/api/v2/agents/{}", id(&worker))).await;
    assert_eq!(agent["name"], "collaborator text stays");
    assert_eq!(agent["bindings"]["workerTeamId"], legacy["id"]);
    for path in [format!("/api/v2/teams?workerId={}",id(&worker)), format!("/api/v1/teams?collaboratorId={}",id(&worker))] {
        assert_eq!(get(&app,&path).await["items"][0]["id"],legacy["id"]);
    }
    assert_eq!(get(&app,&format!("/api/v2/teams/{}/members?role=worker",id(&legacy))).await["items"][0]["role"],"worker");
    assert_eq!(get(&app,&format!("/api/v1/teams/{}/members?role=collaborator",id(&legacy))).await["items"][0]["role"],"collaborator");
    assert_eq!(
        get(&app, "/api/v2/agents?role=worker").await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        request(
            &app,
            "PATCH",
            &format!("/api/v2/teams/{}", id(&legacy)),
            json!({"workerIconId":"rocket","collaboratorIconId":"rocket"}),
            ver(&legacy)
        )
        .await
        .0,
        400
    );
    assert_eq!(request(&app,"GET","/api/v2/teams?workerId=10000000-0000-7000-8000-000000000001&collaboratorId=10000000-0000-7000-8000-000000000001",json!({}),None).await.0,400);
}

#[tokio::test]
async fn stored_legacy_icons_and_replay_snapshots_are_read_without_rewriting() {
    use beeteam::{dto::backend::Outcome, repositories::records::Record};
    use sha2::{Digest, Sha256};
    let (app, repo): (_, Box<dyn beeteam::repositories::contracts::ResourceStore>) =
        if std::env::var("BEE_TEST_DRIVER").as_deref() == Ok("postgres") {
            let (app, pool) = app_with_pool().await;
            (
                app,
                Box::new(beeteam::repositories::resources::ResourceRepository::new(
                    pool,
                )),
            )
        } else {
            let (app, pool) = sqlite_app_with_pool().await;
            (
                app,
                Box::new(beeteam::repositories::sqlite::ResourceRepository::new(pool)),
            )
        };
    let leader = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Legacy"}),
        None,
    )
    .await;
    let data = json!({"name":"Legacy collaborator","slug":"legacy-worker","leaderId":id(&leader),"purpose":"collaborator","context":"collaboratorIconId","leaderIconId":"rocket","collaboratorIconId":"lightbulb"});
    let mut unit = repo.begin().await.unwrap();
    let tid = unit.records.insert(Record::new("teams", data.clone()));
    unit.commit().await.unwrap();
    let v1 = get(&app, &format!("/api/v1/teams/{tid}")).await;
    let v2 = get(&app, &format!("/api/v2/teams/{tid}")).await;
    assert_eq!(v2["workerIconId"], "lightbulb");
    assert_eq!(v2["purpose"], "collaborator");
    assert_eq!(v2["context"], "collaboratorIconId");
    let old_body = json!({"name":"Legacy collaborator","leaderId":id(&leader),"collaboratorIconId":"lightbulb","coordinationContext":manual()});
    let hash = Sha256::digest(serde_json::to_vec(&json!([old_body, {}, {}])).unwrap())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    let key = uuid::Uuid::new_v4();
    let mut unit = repo.begin().await.unwrap();
    assert_eq!(unit.records.get("teams", tid).unwrap().data, data);
    unit.save_replay(
        "human:",
        "createTeam:{}",
        key,
        &hash,
        &Outcome {
            data: v1.clone(),
            version: Some(1),
            created_id: Some(tid),
            file: None,
        },
    )
    .await
    .unwrap();
    unit.commit().await.unwrap();
    let new_body = json!({"name":"Legacy collaborator","leaderId":id(&leader),"workerIconId":"lightbulb","coordinationContext":manual()});
    assert_eq!(
        request_key(&app, "POST", "/api/v2/teams", new_body, None, key).await,
        (201, v2)
    );
    assert_eq!(
        request_key(&app, "POST", "/api/v1/teams", old_body, None, key).await,
        (201, v1.clone())
    );
    let mut unit = repo.begin().await.unwrap();
    assert_eq!(unit.records.get("teams", tid).unwrap().data, data);
    assert_eq!(
        unit.replay("human:", "createTeam:{}", key, &hash)
            .await
            .unwrap()
            .unwrap()
            .data,
        v1
    );
    unit.rollback().await.unwrap();
    let updated = ok(
        &app,
        "PATCH",
        &format!("/api/v2/teams/{tid}"),
        json!({"purpose":"changed"}),
        Some(1),
    )
    .await;
    assert_eq!(updated["workerIconId"], "lightbulb");
    let unit = repo.begin().await.unwrap();
    let stored = &unit.records.get("teams", tid).unwrap().data;
    assert_eq!(stored["workerIconId"], "lightbulb");
    assert!(stored.get("collaboratorIconId").is_none());
    unit.rollback().await.unwrap();
}
