mod support;
use serde_json::{json, Value};
use support::*;

async fn hq(app: &axum::Router) -> (Value, Value, Value) {
    let team = get(app, "/api/v2/teams?name=Bee%20Team%20HQ").await["items"][0].clone();
    let leader = get(app, &format!("/api/v2/agents/{}", team["leaderId"].as_str().unwrap())).await;
    let board = get(app, "/api/v2/boards?name=Getting%20started").await["items"][0].clone();
    (team, leader, board)
}

#[tokio::test]
async fn empty_install_gets_one_ready_hq_and_reseeding_is_idempotent() {
    let (app, state) = seeded_app().await;
    let again = state.backend().ensure_onboarding().await.unwrap();
    let teams = get(&app, "/api/v2/teams").await;
    assert_eq!(teams["total"], 1);
    let (team, leader, board) = hq(&app).await;
    assert_eq!(id(&team), again.team_id.to_string());
    assert_eq!(id(&leader), again.agent_id.to_string());
    assert_eq!(id(&board), again.board_id.to_string());
    assert_eq!(leader["name"], "Bee Team Guide");
    assert_eq!(board["teamId"], team["id"]);
    assert_eq!(get(&app, "/api/v2/agents").await["total"], 1);
    assert_eq!(get(&app, "/api/v2/boards").await["total"], 1);
    let tasks = get(&app, &format!("/api/v2/boards/{}/tasks?limit=50", id(&board))).await;
    assert_eq!(tasks["total"], 6);
    for task in tasks["items"].as_array().unwrap() {
        assert_eq!(task["executorAgentId"], leader["id"]);
        assert!(task["specification"].as_str().unwrap().contains("## Done when"));
        assert!(task.get("systemKey").is_none() && task.get("onboardingSeedVersion").is_none());
    }
    for value in [&team, &leader, &board] {
        assert!(value.get("systemKey").is_none() && value.get("onboardingSeedVersion").is_none());
    }
}

#[tokio::test]
async fn seed_never_recreates_or_rewrites_user_edited_onboarding_tasks() {
    let (app, state) = seeded_app().await;
    let (_, _, board) = hq(&app).await;
    let path = format!("/api/v2/boards/{}/tasks?limit=50", id(&board));
    let task = get(&app, &path).await["items"][0].clone();
    let edited = ok(&app, "PATCH", &format!("/api/v2/tasks/{}", id(&task)), json!({"title":"Mine"}), ver(&task)).await;
    state.backend().ensure_onboarding().await.unwrap();
    assert_eq!(get(&app, &path).await["total"], 6);
    let after = get(&app, &format!("/api/v2/tasks/{}", id(&task))).await;
    assert_eq!(after["title"], "Mine");
    assert_eq!(after["version"], edited["version"]);
}

#[tokio::test]
async fn existing_installations_gain_hq_without_touching_user_records() {
    let (state, config) = app_state().await;
    let app = beeteam::routes::create_router(state.clone(), &config);
    let agent = ok(&app, "POST", "/api/v2/agents", json!({"name":"Lead"}), None).await;
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"Alpha","leaderId":id(&agent),"coordinationContext":manual()}), None).await;
    let lead_version = agent_version(&app, &agent).await;
    state.backend().ensure_onboarding().await.unwrap();
    assert_eq!(get(&app, "/api/v2/teams").await["total"], 2);
    let alpha = get(&app, &format!("/api/v2/teams/{}", id(&team))).await;
    assert_eq!(alpha["version"], team["version"]);
    assert_eq!(agent_version(&app, &agent).await, lead_version);
}

async fn agent_version(app: &axum::Router, agent: &Value) -> Value {
    get(app, &format!("/api/v2/agents/{}", id(agent))).await["version"].clone()
}

#[tokio::test]
async fn concurrent_seeds_create_a_single_hq() {
    let (state, config) = app_state().await;
    let (a, b) = tokio::join!(state.backend().ensure_onboarding(), state.backend().ensure_onboarding());
    assert_eq!(a.unwrap(), b.unwrap());
    let app = beeteam::routes::create_router(state, &config);
    assert_eq!(get(&app, "/api/v2/teams").await["total"], 1);
    assert_eq!(get(&app, "/api/v2/agents").await["total"], 1);
}

#[tokio::test]
async fn system_flag_and_filter_identify_hq_among_user_teams() {
    let (app, _) = seeded_app().await;
    let agent = ok(&app, "POST", "/api/v2/agents", json!({"name":"Lead"}), None).await;
    assert_eq!(agent["system"], false);
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"Alpha","leaderId":id(&agent),"coordinationContext":manual()}), None).await;
    assert_eq!(team["system"], false);
    let system = get(&app, "/api/v2/teams?system=true").await;
    assert_eq!(system["total"], 1);
    assert_eq!(system["items"][0]["name"], "Bee Team HQ");
    assert_eq!(system["items"][0]["system"], true);
    let user = get(&app, "/api/v2/teams?system=false").await;
    assert_eq!(user["total"], 1);
    assert_eq!(user["items"][0]["system"], false);
    let (team, leader, board) = hq(&app).await;
    assert_eq!((team["system"].clone(), leader["system"].clone(), board["system"].clone()), (json!(true), json!(true), json!(true)));
    assert_eq!(get(&app, &format!("/api/v2/boards/{}", id(&board))).await["system"], true);
    assert_eq!(get(&app, "/api/v2/agents").await["items"].as_array().unwrap().iter().filter(|a| a["system"] == true).count(), 1);
    let (status, _) = request(&app, "POST", "/api/v2/agents", json!({"name":"Fake","systemKey":"onboarding"}), None).await;
    assert_eq!(status, 400);
}
