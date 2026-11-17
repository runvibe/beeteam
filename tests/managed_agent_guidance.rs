mod managed_fixture;
mod support;

use managed_fixture::*;
use serde_json::json;
use support::*;
use uuid::Uuid;

#[tokio::test]
async fn team_chat_applies_leader_guidance_on_first_and_resumed_turns() {
    let (app, agent, team, _) = fixture().await;
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
    }
}
