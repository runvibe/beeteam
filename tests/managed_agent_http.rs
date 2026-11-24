mod managed_fixture;
mod support;
use beeteam::config::CorsConfig;
use managed_fixture::*;
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use support::*;
use uuid::Uuid;

#[tokio::test]
async fn team_chat_starts_without_configuring_agent_or_enabling_worker_requests() {
    let (app, agent, team, _) = fixture().await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let direct = request_key(&app, "POST", &path,
        json!({"content":"worker-tools"}), None, Uuid::new_v4()).await;
    assert_eq!(direct.0, 400, "{direct:?}");
    let first = request_key(&app, "POST", &path,
        json!({"content":"team-chat-defaults","teamId":id(&team)}), None, Uuid::new_v4()).await;
    assert_eq!(first.0, 202, "{first:?}");
    assert_eq!(first.1["configurationVersion"], 1);
    wait_state(&app, &first.1, "completed").await;
    let next = request_key(&app, "POST", &path,
        json!({"content":"team-chat-defaults","conversationId":first.1["conversationId"]}), None, Uuid::new_v4()).await;
    assert_eq!(next.0, 202, "{next:?}");
    wait_state(&app, &next.1, "completed").await;
    let config = get(&app, &format!("/api/v2/agents/{}/execution-config", id(&agent))).await;
    assert!(config["configuration"].is_null());
    let updated = request_key(&app, "PUT", &format!("/api/v2/agents/{}/execution-config", id(&agent)),
        json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}}),
        ver(&agent), Uuid::new_v4()).await;
    assert_eq!(updated.0, 200, "{updated:?}");
    let stale = request_key(&app, "POST", &path,
        json!({"content":"team-chat-tools","conversationId":first.1["conversationId"]}), None, Uuid::new_v4()).await;
    assert_eq!(stale.0, 409, "{stale:?}");
}

#[tokio::test]
async fn team_chat_uses_file_scope_while_direct_requests_keep_agent_scope() {
    let (app, agent, team, _) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let team_request = request_key(&app, "POST", &path,
        json!({"content":"team-chat-tools","teamId":id(&team)}), None, Uuid::new_v4()).await;
    assert_eq!(team_request.0, 202, "{team_request:?}");
    wait_state(&app, &team_request.1, "completed").await;
    let direct = request_key(&app, "POST", &path,
        json!({"content":"worker-tools"}), None, Uuid::new_v4()).await;
    assert_eq!(direct.0, 202, "{direct:?}");
    wait_state(&app, &direct.1, "completed").await;
}

#[tokio::test]
async fn omitted_mode_is_legacy_and_conflicts_with_an_explicit_standard_retry() {
    let (app, agent, _, _) = configured().await;
    let leader = ok(&app, "POST", "/api/v2/agents", json!({"name":"Worker test leader"}), None).await;
    ok(&app, "POST", "/api/v2/teams", json!({"name":"Worker test team","leaderId":id(&leader),"workerIds":[id(&agent)],"coordinationContext":manual()}), None).await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let key = Uuid::new_v4();
    let body = json!({"content":"legacy-access-test"});
    let first = request_key(&app, "POST", &path, body.clone(), None, key).await;
    assert_eq!(first.0, 202, "{first:?}");
    assert!(first.1.get("accessMode").is_none());
    let snapshot = wait_state(&app, &first.1, "completed").await;
    assert!(snapshot["request"].get("accessMode").is_none());
    assert_eq!(request_key(&app, "POST", &path, body, None, key).await, first);
    let changed = request_key(&app, "POST", &path, json!({"content":"legacy-access-test","accessMode":"standard"}), None, key).await;
    assert_eq!(changed.0, 409, "{changed:?}");

    let explicit_key = Uuid::new_v4();
    let explicit = request_key(&app, "POST", &path, json!({"content":"explicit-standard","accessMode":"standard"}), None, explicit_key).await;
    assert_eq!(explicit.1["accessMode"], "standard");
    wait_state(&app, &explicit.1, "completed").await;
    let changed = request_key(&app, "POST", &path, json!({"content":"explicit-standard"}), None, explicit_key).await;
    assert_eq!(changed.0, 409, "{changed:?}");
}

#[tokio::test]
async fn uncertain_mode_replay_never_starts_another_turn() {
    let (app, agent, _, provider) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let key = Uuid::new_v4();
    let body = json!({"content":"uncertain-access-test","accessMode":"read_only"});
    let first = request_key(&app, "POST", &path, body.clone(), None, key).await;
    let snapshot = wait_state(&app, &first.1, "uncertain").await;
    assert_eq!(snapshot["request"]["accessMode"], "read_only");
    assert_eq!(request_key(&app, "POST", &path, body, None, key).await, first);
    let conflict = request_key(&app, "POST", &path, json!({"content":"uncertain-access-test","accessMode":"full_access"}), None, key).await;
    assert_eq!(conflict.0, 409);
    assert_eq!(provider.2.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn pre_access_mode_managed_replay_keeps_its_original_receipt() {
    use beeteam::dto::backend::Outcome;
    let (app, agent, _, _, db) = fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let key = Uuid::new_v4();
    let params = json!({"agentId":id(&agent)});
    let canonical = json!({"content":"historic","conversationId":null,"taskId":null});
    let hash = serde_json::to_string(&json!({"body":canonical,"version":null})).unwrap();
    let historical = json!({"id":Uuid::now_v7(),"state":"queued"});
    let (store, _) = db.stores();
    let mut unit = store.begin().await.unwrap();
    unit.save_replay("managed-local", &format!("managed:send:{params}"), key, &hash, &Outcome::data(historical.clone())).await.unwrap();
    unit.commit().await.unwrap();
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let replay = request_key(&app, "POST", &path, json!({"content":"historic"}), None, key).await;
    assert_eq!(replay.0, 202, "{replay:?}");
    assert_eq!(replay.1, historical);
    let replay_explicit_default = request_key(&app, "POST", &path, json!({"content":"historic","accessMode":"standard"}), None, key).await;
    assert_eq!(replay_explicit_default, replay);
    let conflict = request_key(&app, "POST", &path, json!({"content":"historic","accessMode":"full_access"}), None, key).await;
    assert_eq!(conflict.0, 409);
}

#[tokio::test]
async fn configuration_read_failure_is_clear_and_not_uncertain() {
    let (app, agent, _, _) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let result = request_key(&app, "POST", &path, json!({"content":"config-error","accessMode":"codex_config"}), None, Uuid::new_v4()).await;
    let snapshot = wait_state(&app, &result.1, "failed").await;
    assert_eq!(snapshot["request"]["error"]["code"], "codex_config_invalid");
    assert!(snapshot["request"]["error"]["message"].as_str().unwrap().contains("Codex configuration"));
    let spec: Value = serde_json::from_str(include_str!("../docs/proposals/managed-agents-openapi.json")).unwrap();
    beeteam::dto::contracts::validate_schema(&spec, &spec["components"]["schemas"]["RequestSnapshot"], &snapshot).unwrap();
}

#[tokio::test]
async fn chat_tools_file_errors_are_reported_without_marking_the_turn_uncertain() {
    let (app, agent, _, _) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let result = request_key(&app, "POST", &path, json!({"content":"chat-tools-error"}), None, Uuid::new_v4()).await;
    let snapshot = wait_state(&app, &result.1, "failed").await;
    assert_eq!(snapshot["request"]["error"]["code"], "chat_tools_config_invalid");
    assert!(snapshot["request"]["error"]["message"].as_str().unwrap().contains("chat-tools.toml"));
    let spec: Value = serde_json::from_str(include_str!("../docs/proposals/managed-agents-openapi.json")).unwrap();
    beeteam::dto::contracts::validate_schema(&spec, &spec["components"]["schemas"]["RequestSnapshot"], &snapshot).unwrap();
}

#[tokio::test]
async fn access_mode_is_durable_and_part_of_managed_replay() {
    let (app, agent, _, _) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let key = Uuid::new_v4();
    let body = json!({"content":"access-mode-test","accessMode":"read_only"});
    let first = request_key(&app, "POST", &path, body.clone(), None, key).await;
    assert_eq!(first.0, 202, "{first:?}");
    assert_eq!(first.1["accessMode"], "read_only");
    assert_eq!(first, request_key(&app, "POST", &path, body, None, key).await);
    let changed = request_key(&app, "POST", &path, json!({"content":"access-mode-test","accessMode":"full_access"}), None, key).await;
    assert_eq!(changed.0, 409, "{changed:?}");
    let snapshot = wait_state(&app, &first.1, "completed").await;
    assert_eq!(snapshot["request"]["accessMode"], "read_only");
}

#[tokio::test]
async fn owned_requests_continue_without_external_binding() {
    let (app, agent, _, provider) = fixture().await;
    let root = format!("/api/v2/agents/{}", id(&agent));
    let config = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    let response = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        config,
        ver(&agent),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(response.0, 200, "{response:?}");
    let key = Uuid::new_v4();
    let first = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"hello"}),
        None,
        key,
    )
    .await;
    assert_eq!(first.0, 202, "{first:?}");
    let replay = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"hello"}),
        None,
        key,
    )
    .await;
    assert_eq!(first, replay);
    let mut snapshot = Value::Null;
    for _ in 0..100 {
        snapshot = get(
            &app,
            &format!("/api/v2/agent-requests/{}", first.1["id"].as_str().unwrap()),
        )
        .await;
        if snapshot["request"]["state"] == "completed" {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    assert_eq!(snapshot["request"]["state"], "completed", "{snapshot}");
    let spec: Value = serde_json::from_str(include_str!(
        "../docs/proposals/managed-agents-openapi.json"
    ))
    .unwrap();
    beeteam::dto::contracts::validate_schema(
        &spec,
        &spec["components"]["schemas"]["RequestSnapshot"],
        &snapshot,
    )
    .unwrap();
    assert_eq!(snapshot["messages"]["items"].as_array().unwrap().len(), 2);
    assert_eq!(snapshot["messages"]["items"][1]["content"], "Response");
    assert_eq!(provider.0.load(Ordering::SeqCst), 1);
    let workspace = std::env::temp_dir()
        .join("beeteam-test-workspaces")
        .join(id(&agent));
    std::fs::remove_dir(&workspace).unwrap(); // Empty isolated test directory only.
    let next = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"again","conversationId":first.1["conversationId"]}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(next.0, 202, "{next:?}");
    assert!(!snapshot.to_string().contains("externalId"));
}

#[tokio::test]
async fn queue_serializes_cancel_and_configuration_is_guarded() {
    let (app, a, _, p) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&a));
    let first = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"hold"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(first.0, 202);
    wait_state(&app, &first.1, "running").await;
    let next = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"next"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(next.0, 202);
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    assert_eq!(p.0.load(Ordering::SeqCst), 1);
    let snap = get(&app, &format!("/api/v2/agent-requests/{}", id(&first.1))).await;
    let cancel = request_key(
        &app,
        "POST",
        &format!("/api/v2/agent-requests/{}/cancel", id(&first.1)),
        Value::Null,
        ver(&snap["request"]),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(cancel.0, 200, "{cancel:?}");
    wait_state(&app, &first.1, "cancelled").await;
    wait_state(&app, &next.1, "completed").await;
    assert_eq!(p.0.load(Ordering::SeqCst), 2);
}
#[tokio::test]
async fn approval_targets_original_request() {
    let (app, a, _, _) = configured().await;
    let r = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&a)),
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snap = wait_state(&app, &r.1, "awaiting_approval").await;
    let approval = &snap["approvals"][0];
    let result = request_key(
        &app,
        "POST",
        &format!("/api/v2/agent-approvals/{}/decision", id(approval)),
        json!({"decision":"accept"}),
        ver(approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(result.0, 200, "{result:?}");
    wait_state(&app, &r.1, "completed").await;
}

#[tokio::test]
async fn team_managed_approvals_follow_current_worker_membership() {
    let (app, worker, _, _) = configured().await;
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Other leader"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({
            "name":"Workers", "leaderId":id(&leader), "workerIds":[id(&worker)],
            "coordinationContext":manual()
        }),
        None,
    )
    .await;
    let request = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&worker)),
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &request.1, "awaiting_approval").await;
    let url = format!("/api/v2/teams/{}/managed-approvals", id(&team));
    let page = get(&app, &url).await;
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    assert_eq!(page["items"][0]["approval"], snapshot["approvals"][0]);
    assert_eq!(page["items"][0]["request"], snapshot["request"]);
    assert_eq!(
        page["items"][0]["agent"],
        json!({"id":id(&worker),"name":"Chat leader"})
    );
    assert!(page["nextCursor"].is_null());
    let decision = request_key(
        &app,
        "POST",
        &format!(
            "/api/v2/agent-approvals/{}/decision",
            id(&snapshot["approvals"][0])
        ),
        json!({"decision":"accept"}),
        ver(&snapshot["approvals"][0]),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(decision.0, 200);
    assert_eq!(get(&app, &url).await["items"], json!([]));
}
#[tokio::test]
async fn rejects_external_ids_and_conflicting_idempotency() {
    let (app, a, _, _) = configured().await;
    let path = format!("/api/v2/agents/{}/requests", id(&a));
    let key = Uuid::new_v4();
    let r = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"hello","externalId":"desktop"}),
        None,
        key,
    )
    .await;
    assert_eq!(r.0, 400);
    let r = request_key(&app, "POST", &path, json!({"content":"hello"}), None, key).await;
    assert_eq!(r.0, 202);
    let r = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"different"}),
        None,
        key,
    )
    .await;
    assert_eq!(r.0, 409);
}

#[tokio::test]
async fn scoped_decision_rejects_transferred_worker_but_replays_original_decision() {
    use axum::{body::Body, http::Request};
    use beeteam::repositories::records::Record;
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, worker, _, _, db) =
        fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let config = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    assert_eq!(
        request_key(
            &app,
            "PUT",
            &format!("/api/v2/agents/{}/execution-config", id(&worker)),
            config,
            ver(&worker),
            Uuid::new_v4()
        )
        .await
        .0,
        200
    );
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Team leader"}),
        None,
    )
    .await;
    let leader_b = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Other leader"}),
        None,
    )
    .await;
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"First team","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}), None).await;
    let other = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"Second team","leaderId":id(&leader_b),"coordinationContext":manual()}),
        None,
    )
    .await;
    let path = format!("/api/v2/agents/{}/requests", id(&worker));
    let first = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let first_snap = wait_state(&app, &first.1, "awaiting_approval").await;
    let first_approval = &first_snap["approvals"][0];
    let first_path = format!("/api/v2/agent-approvals/{}/decision", id(first_approval));
    let first_body = json!({"decision":"accept","expectedTeamId":id(&team)});
    let key = Uuid::new_v4();
    let accepted = request_key(
        &app,
        "POST",
        &first_path,
        first_body.clone(),
        ver(first_approval),
        key,
    )
    .await;
    assert_eq!(accepted.0, 200, "{accepted:?}");
    wait_state(&app, &first.1, "completed").await;
    let second = request_key(
        &app,
        "POST",
        &path,
        json!({"content":"approve"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let second_snap = wait_state(&app, &second.1, "awaiting_approval").await;
    let second_approval = &second_snap["approvals"][0];
    let second_path = format!("/api/v2/agent-approvals/{}/decision", id(second_approval));
    for invalid in [
        json!(null),
        json!(7),
        json!(Uuid::new_v4().to_string()),
        json!(id(&team).replace('-', "")),
    ] {
        let response = request_key(
            &app,
            "POST",
            &second_path,
            json!({"decision":"accept","expectedTeamId":invalid}),
            ver(second_approval),
            Uuid::new_v4(),
        )
        .await;
        assert_eq!(response.0, 400, "{response:?}");
        assert_eq!(response.1["code"], "invalid_request");
    }
    let (store, _) = db.stores();
    let mut unit = store.begin().await.unwrap();
    let worker_id = Uuid::parse_str(id(&worker)).unwrap();
    let membership = unit
        .records
        .list("memberships")
        .into_iter()
        .find(|r| r.reference("agentId") == Some(worker_id))
        .unwrap()
        .id;
    unit.records
        .get_mut("memberships", membership)
        .unwrap()
        .deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    let mut unit = store.begin().await.unwrap();
    unit.records.insert(Record::new(
        "memberships",
        json!({"agentId":worker_id,"teamId":id(&other)}),
    ));
    unit.commit().await.unwrap();
    let rejected = request_key(
        &app,
        "POST",
        &second_path,
        first_body.clone(),
        ver(second_approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(rejected.0, 409, "{rejected:?}");
    assert_eq!(rejected.1["code"], "approval_team_mismatch");
    let replay = request_key(
        &app,
        "POST",
        &first_path,
        first_body,
        ver(first_approval),
        key,
    )
    .await;
    assert_eq!(replay, accepted);
    let mcp=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"decideAgentRequestApproval","arguments":{"params":{"approvalId":id(first_approval)},"body":{"decision":"accept","expectedTeamId":id(&team)},"expectedVersion":ver(first_approval),"idempotencyKey":key}}}).to_string())).unwrap()).await.unwrap();
    let response: Value =
        serde_json::from_slice(&mcp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(response["result"]["isError"], false, "{response}");
    assert_eq!(response["result"]["structuredContent"]["data"], accepted.1);
    let mcp=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"decideAgentRequestApproval","arguments":{"params":{"approvalId":id(second_approval)},"body":{"decision":"accept","expectedTeamId":id(&team)},"expectedVersion":ver(second_approval),"idempotencyKey":Uuid::new_v4()}}}).to_string())).unwrap()).await.unwrap();
    let response: Value =
        serde_json::from_slice(&mcp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(response["result"]["isError"], true, "{response}");
    assert_eq!(
        response["result"]["structuredContent"]["code"],
        "approval_team_mismatch"
    );
    let direct = request_key(
        &app,
        "POST",
        &second_path,
        json!({"decision":"accept"}),
        ver(second_approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(direct.0, 200, "{direct:?}");
}

#[tokio::test]
async fn team_approvals_page_by_uuid_and_follow_transfer() {
    use axum::{body::Body, http::Request};
    use beeteam::repositories::records::Record;
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, worker, worker_leads, _, db) =
        fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Leader A"}),
        None,
    )
    .await;
    let leader_b = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Leader B"}),
        None,
    )
    .await;
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"A","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}), None).await;
    let other = ok(
        &app,
        "POST",
        "/api/v2/teams",
        json!({"name":"B","leaderId":id(&leader_b),"coordinationContext":manual()}),
        None,
    )
    .await;
    let base = format!("/api/v2/teams/{}/managed-approvals", id(&team));
    assert_eq!(get(&app, &base).await["items"], json!([]));
    let (store, _) = db.stores();
    let mut unit = store.begin().await.unwrap();
    let worker_id = Uuid::parse_str(id(&worker)).unwrap();
    let conversation = Uuid::now_v7();
    let request_id = unit.records.insert(Record::new("managed_requests", json!({
        "agentId":worker_id,"conversationId":conversation,"taskId":null,"configurationVersion":1,
        "state":"completed","origin":{"transport":"http","label":null},"error":null
    })));
    let mut ids = Vec::new();
    for n in 0..53 {
        let row = Record::new(
            "managed_approvals",
            json!({"agentId":worker_id,"requestId":request_id,
            "state":"pending","kind":"network","description":format!("Approval {n}"),"expiresAt":null}),
        );
        ids.push(row.id.to_string());
        unit.records.insert(row);
    }
    for state in ["accepted", "expired"] {
        unit.records.insert(Record::new("managed_approvals", json!({"agentId":worker_id,"requestId":request_id,"state":state,"kind":"network","description":"Excluded","expiresAt":null})));
    }
    let mut deleted = Record::new(
        "managed_approvals",
        json!({"agentId":worker_id,"requestId":request_id,"state":"pending","kind":"network","description":"Deleted","expiresAt":null}),
    );
    deleted.deleted_at = Some(chrono::Utc::now());
    unit.records.insert(deleted);
    unit.records
        .get_mut("agents", worker_id)
        .unwrap()
        .archived_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    ids.sort_by(|a, b| b.cmp(a));

    let first = get(&app, &base).await;
    assert_eq!(first["items"].as_array().unwrap().len(), 50);
    let got: Vec<_> = first["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| id(&x["approval"]).to_owned())
        .collect();
    assert_eq!(got, ids[..50]);
    let cursor = first["nextCursor"].as_str().unwrap();
    let second = get(&app, &format!("{base}?cursor={cursor}")).await;
    let got: Vec<_> = second["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| id(&x["approval"]).to_owned())
        .collect();
    assert_eq!(got, ids[50..]);
    assert!(second["nextCursor"].is_null());
    assert_eq!(
        get(&app, &format!("{base}?limit=1")).await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    for url in [
        format!("{base}?limit=0"),
        format!("{base}?limit=101"),
        format!("{base}?cursor=invalid"),
        format!(
            "/api/v2/teams/{}/managed-approvals?cursor={cursor}",
            id(&other)
        ),
    ] {
        let response = request(&app, "GET", &url, json!({}), None).await;
        assert_eq!(response.0, 400, "{response:?}");
        assert_eq!(response.1["code"], "invalid_request");
    }
    let missing = request(
        &app,
        "GET",
        &format!("/api/v2/teams/{}/managed-approvals", Uuid::now_v7()),
        json!({}),
        None,
    )
    .await;
    assert_eq!(missing.0, 404);
    assert_eq!(missing.1["code"], "not_found");
    let mcp=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"listTeamManagedApprovals","arguments":{"params":{"teamId":id(&team)}}}}).to_string())).unwrap()).await.unwrap();
    let result: Value =
        serde_json::from_slice(&mcp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(result["result"]["isError"], false, "{result}");
    assert_eq!(result["result"]["structuredContent"]["data"], first);
    assert_eq!(
        get(
            &app,
            &format!("/api/v2/teams/{}/managed-approvals", id(&worker_leads))
        )
        .await["items"],
        json!([])
    );

    let mut unit = store.begin().await.unwrap();
    unit.records
        .get_mut("managed_approvals", Uuid::parse_str(&ids[50]).unwrap())
        .unwrap()
        .data["state"] = json!("accepted");
    unit.commit().await.unwrap();
    assert_eq!(
        get(&app, &format!("{base}?cursor={cursor}")).await["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );

    let mut unit = store.begin().await.unwrap();
    let membership = unit
        .records
        .list("memberships")
        .into_iter()
        .find(|r| r.reference("agentId") == Some(worker_id))
        .unwrap()
        .id;
    let row = unit.records.get_mut("memberships", membership).unwrap();
    row.deleted_at = Some(chrono::Utc::now());
    unit.commit().await.unwrap();
    assert_eq!(get(&app, &base).await["items"], json!([]));
    let mut unit = store.begin().await.unwrap();
    unit.records.insert(Record::new(
        "memberships",
        json!({"agentId":worker_id,"teamId":id(&other)}),
    ));
    unit.commit().await.unwrap();
    assert_eq!(
        get(
            &app,
            &format!("/api/v2/teams/{}/managed-approvals?limit=100", id(&other))
        )
        .await["items"]
            .as_array()
            .unwrap()
            .len(),
        52
    );
}

#[tokio::test]
async fn team_approvals_hydrate_one_consistent_snapshot_during_writes() {
    use beeteam::repositories::records::Record;
    let (app, worker, _, _, db) =
        fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let leader = ok(
        &app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Snapshot leader"}),
        None,
    )
    .await;
    let team = ok(&app, "POST", "/api/v2/teams", json!({"name":"Snapshot team","leaderId":id(&leader),"workerIds":[id(&worker)],"coordinationContext":manual()}), None).await;
    let route = format!("/api/v2/teams/{}/managed-approvals", id(&team));
    assert_eq!(get(&app, &route).await["items"], json!([]));
    let (store, _) = db.stores();
    let worker_id = Uuid::parse_str(id(&worker)).unwrap();
    let mut unit = store.begin().await.unwrap();
    unit.records.get_mut("agents", worker_id).unwrap().data["name"] = json!("Snapshot A");
    let request_id = unit.records.insert(Record::new("managed_requests", json!({
        "agentId":worker_id,"conversationId":Uuid::now_v7(),"taskId":null,"configurationVersion":1,
        "state":"completed","origin":{"transport":"http","label":null},"error":null
    })));
    unit.records.insert(Record::new(
        "managed_approvals",
        json!({
            "agentId":worker_id,"requestId":request_id,"state":"pending","kind":"network",
            "description":"Snapshot","expiresAt":null
        }),
    ));
    unit.commit().await.unwrap();
    let writer_store = store.clone();
    let writer = tokio::spawn(async move {
        for i in 0..50 {
            let mut u = writer_store.begin().await.unwrap();
            let (name, state) = if i % 2 == 0 {
                ("Snapshot B", "failed")
            } else {
                ("Snapshot A", "completed")
            };
            u.records.get_mut("agents", worker_id).unwrap().data["name"] = json!(name);
            u.records
                .get_mut("managed_requests", request_id)
                .unwrap()
                .data["state"] = json!(state);
            u.commit().await.unwrap();
            tokio::task::yield_now().await;
        }
    });
    for _ in 0..50 {
        let page = get(&app, &route).await;
        let item = &page["items"][0];
        assert!(
            matches!(
                (
                    item["agent"]["name"].as_str(),
                    item["request"]["state"].as_str()
                ),
                (Some("Snapshot A"), Some("completed")) | (Some("Snapshot B"), Some("failed"))
            ),
            "{page}"
        );
    }
    writer.await.unwrap();
}

#[tokio::test]
async fn decline_is_not_reported_as_completed() {
    let (app, a, _, _) = configured().await;
    let r = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&a)),
        json!({"content":"decline"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snap = wait_state(&app, &r.1, "awaiting_approval").await;
    let approval = &snap["approvals"][0];
    assert!(approval["description"]
        .as_str()
        .unwrap()
        .contains("example.test"));
    let result = request_key(
        &app,
        "POST",
        &format!("/api/v2/agent-approvals/{}/decision", id(approval)),
        json!({"decision":"decline"}),
        ver(approval),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(result.0, 200, "{result:?}");
    wait_state(&app, &r.1, "failed").await;
}
#[tokio::test]
async fn omitted_mode_replay_is_shared_by_http_and_mcp() {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, agent, _, provider) = configured().await;
    let key = Uuid::new_v4();
    let body = json!({"content":"legacy-access-test"});
    let path = format!("/api/v2/agents/{}/requests", id(&agent));
    let first = request_key(&app, "POST", &path, body.clone(), None, key).await;
    wait_state(&app, &first.1, "completed").await;
    for (mode, conflict) in [(None, false), (Some("standard"), true)] {
        let mut mcp_body = body.clone();
        if let Some(mode) = mode {
            mcp_body["accessMode"] = json!(mode);
        }
        let response=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"sendAgentRequest","arguments":{"params":{"agentId":id(&agent)},"body":mcp_body,"idempotencyKey":key}}}).to_string())).unwrap()).await.unwrap();
        let result: Value = serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
        assert_eq!(result["result"]["isError"], conflict, "{result}");
        if !conflict {
            assert_eq!(result["result"]["structuredContent"]["data"], first.1);
        }
    }
    assert_eq!(provider.2.load(Ordering::SeqCst), 1);
}

#[cfg(feature = "mcp")]
#[tokio::test]
async fn mcp_and_http_share_the_original_receipt() {
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let (app, a, _, _) = configured().await;
    let key = Uuid::new_v4();
    let body = json!({"content":"same request","accessMode":"read_only"});
    let first = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&a)),
        body.clone(),
        None,
        key,
    )
    .await;
    let response=app.clone().oneshot(Request::builder().method("POST").uri("/mcp").header("host","127.0.0.1").header("content-type","application/json").header("accept","application/json, text/event-stream").header("mcp-protocol-version","2025-11-25").body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"sendAgentRequest","arguments":{"params":{"agentId":id(&a).to_uppercase()},"body":body,"idempotencyKey":key}}}).to_string())).unwrap()).await.unwrap();
    let result: Value =
        serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(result["result"]["isError"], false, "{result}");
    assert_eq!(result["result"]["structuredContent"]["data"], first.1);
    assert_eq!(first.1["accessMode"], "read_only");
}

#[tokio::test]
async fn automatic_workspace_is_resolved_and_replayed() {
    let (app, agent, _, _) = fixture().await;
    let root = format!("/api/v2/agents/{}", id(&agent));
    let body = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    let key = Uuid::new_v4();
    let first = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        body.clone(),
        ver(&agent),
        key,
    )
    .await;
    assert_eq!(first.0, 200, "{first:?}");
    let replay = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        body,
        ver(&agent),
        key,
    )
    .await;
    assert_eq!(first, replay);
    let state = get(&app, &format!("{root}/execution-config")).await;
    assert!(state["configuration"].get("projectRoot").is_none());
    let path = std::env::temp_dir()
        .join("beeteam-test-workspaces")
        .join(id(&agent));
    let path = path.to_str().unwrap();
    assert!(std::path::Path::new(path).is_dir());
    assert!(path.ends_with(id(&agent)));
    std::fs::remove_dir(path).unwrap(); // Empty isolated test directory only.
    let mut invalid = json!({"provider":"codex","toolProfile":{"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    invalid["projectRoot"] = json!(std::env::temp_dir());
    let rejected = request_key(
        &app,
        "PUT",
        &format!("{root}/execution-config"),
        invalid,
        ver(&state),
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(rejected.0, 400, "{rejected:?}");
    let sent = request_key(
        &app,
        "POST",
        &format!("{root}/requests"),
        json!({"content":"hello"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(sent.0, 202, "{sent:?}");
}

#[tokio::test]
async fn generated_images_are_stored_once_and_served_from_the_conversation() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"draw"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(sent.0, 202, "{sent:?}");
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    let message = &snapshot["messages"]["items"][1];
    assert_eq!(message["content"], "Response");
    let images = message["images"].as_array().unwrap();
    assert_eq!(images.len(), 1, "{message}");
    assert_eq!(images[0]["mediaType"], "image/png");
    assert_eq!(images[0]["description"], "Robot bees");
    assert!(images[0].get("providerItemId").is_none());
    let conversation = sent.1["conversationId"].as_str().unwrap();
    let path = format!(
        "/api/v2/agent-conversations/{conversation}/messages/{}/images/{}",
        id(message),
        id(&images[0])
    );
    let (status, headers, bytes) = raw_get(&app, &path).await;
    assert_eq!(status, 200);
    assert_eq!(headers["content-type"], "image/png");
    assert_eq!(headers["x-content-type-options"], "nosniff");
    assert_eq!(bytes, TEST_PNG);
    let foreign = format!(
        "/api/v2/agent-conversations/{}/messages/{}/images/{}",
        Uuid::now_v7(),
        id(message),
        id(&images[0])
    );
    assert_eq!(raw_get(&app, &foreign).await.0, 404);
    let unknown = format!(
        "/api/v2/agent-conversations/{conversation}/messages/{}/images/{}",
        id(message),
        Uuid::now_v7()
    );
    assert_eq!(raw_get(&app, &unknown).await.0, 404);
}

#[path = "managed_agent_http/files.rs"]
mod files;
#[path = "managed_agent_http/reasoning.rs"]
mod reasoning;

async fn raw_get(app: &axum::Router, path: &str) -> (u16, axum::http::HeaderMap, Vec<u8>) {
    use http_body_util::BodyExt;
    use tower::ServiceExt;
    let response = app
        .clone()
        .oneshot(
            axum::http::Request::get(path)
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    let headers = response.headers().clone();
    let bytes = response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes()
        .to_vec();
    (status, headers, bytes)
}
