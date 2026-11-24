mod managed_fixture;
mod support;

use managed_fixture::*;
use serde_json::json;
use support::*;
use uuid::Uuid;

#[tokio::test]
async fn team_chat_applies_leader_guidance_on_first_and_resumed_turns() {
    let (app, agent, team, _) = fixture().await;
    let agent_path = format!("/api/v2/agents/{}", id(&agent));
    let legacy_custom = "Guide the user through the Getting started board. Prefer the Bee Team MCP tools and skills to create teams, agents, boards and tasks on the user's behalf after they agree.\nMy custom instruction: preserve my workflow.";
    ok(&app, "PATCH", &agent_path, json!({"workInstructions":legacy_custom}), ver(&agent)).await;
    let before = get(&app, &agent_path).await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let first = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"show-guidance","teamId":id(&team)}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(first.0, 202);
    let snapshot = wait_state(&app, &first.1, "completed").await;
    assert!(snapshot["messages"]["items"][1]["content"]
        .as_str()
        .unwrap()
        .contains("Bee Team role: leader"));
    assert_creation_route(snapshot["messages"]["items"][1]["content"].as_str().unwrap());
    let next = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"show-guidance","conversationId":first.1["conversationId"]}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &next.1, "completed").await;
    assert!(snapshot["messages"]["items"][1]["content"]
        .as_str()
        .unwrap()
        .contains("Bee Team role: leader"));
    assert_creation_route(snapshot["messages"]["items"][1]["content"].as_str().unwrap());
    let after = get(&app, &agent_path).await;
    assert_eq!(after["workInstructions"], legacy_custom);
    assert_eq!(after["version"], before["version"]);
}

#[tokio::test]
async fn task_requests_use_current_team_role_and_contextless_requests_do_not_guess() {
    let (app, _, _, _) = fixture().await;
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Guidance leader"}),
        None,
    )
    .await;
    let worker = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Guidance worker"}),
        None,
    )
    .await;
    let team = ok(&app, "POST", "/api/v2/teams",
        json!({"name":"Guidance team","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}), None).await;
    let board = ok(
        &app,
        "POST",
        "/api/v2/boards",
        json!({"name":"Guidance board","teamId":id(&team)}),
        None,
    )
    .await;
    let task = ok(&app, "POST", &format!("/api/v2/boards/{}/tasks", id(&board)),
        json!({"title":"Guidance task","workScope":test_project_scope(),"authorAgentId":id(&leader),"executorAgentId":id(&worker),"coordinationContext":manual()}), None).await;
    for agent in [&leader, &worker] {
        let current = get(&app, &format!("/api/v2/agents/{}", id(agent))).await;
        let config = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
        let configured = request_key(
            &app,
            "PUT",
            &format!("/api/v2/agents/{}/execution-config", id(agent)),
            config,
            ver(&current),
            Uuid::new_v4(),
        )
        .await;
        assert_eq!(configured.0, 200, "{configured:?}");
    }
    for (agent, task_id, expected) in [
        (&leader, Some(id(&task)), "Bee Team role: leader"),
        (&worker, Some(id(&task)), "Bee Team role: worker"),
        (&worker, None, "Bee Team role: unassigned"),
    ] {
        let body = if let Some(task) = task_id {
            json!({"content":"show-guidance","taskId":task})
        } else {
            json!({"content":"show-guidance"})
        };
        let request = request_key(
            &app,
            "POST",
            &format!("/api/v2/agents/{}/requests", id(agent)),
            body,
            None,
            Uuid::new_v4(),
        )
        .await;
        assert_eq!(request.0, 202, "{request:?}");
        let snapshot = wait_state(&app, &request.1, "completed").await;
        let guidance = snapshot["messages"]["items"][1]["content"]
            .as_str()
            .unwrap();
        assert!(guidance.contains(expected), "{guidance}");
        assert_creation_route(guidance);
        let resumed = request_key(
            &app,
            "POST",
            &format!("/api/v2/agents/{}/requests", id(agent)),
            json!({"content":"show-guidance","conversationId":request.1["conversationId"],"taskId":task_id}),
            None,
            Uuid::new_v4(),
        )
        .await;
        assert_eq!(resumed.0, 202, "{resumed:?}");
        let snapshot = wait_state(&app, &resumed.1, "completed").await;
        let guidance = snapshot["messages"]["items"][1]["content"].as_str().unwrap();
        assert!(guidance.contains(expected), "{guidance}");
        assert_creation_route(guidance);
    }
}

fn assert_creation_route(guidance: &str) {
    assert!(guidance.contains("get_creation_guidance"), "{guidance}");
    assert!(guidance.contains("team, agent, board or task"));
    assert!(guidance.contains("legacy Bee Team Guide"));
    assert!(guidance.contains("Do not announce or read a creation skill"));
    assert!(guidance.contains("Do not conceal approvals, failures or tool audit evidence"));
}
