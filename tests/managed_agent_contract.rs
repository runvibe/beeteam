use beeteam::dto::managed_agents::{ExecutionConfiguration, SendAgentRequest};
use serde_json::{json, Value};

#[test]
fn shared_json_schema_fixtures_match_rust_validation() {
    let document: Value = serde_json::from_str(include_str!(
        "../docs/proposals/managed-agents-openapi.json"
    ))
    .unwrap();
    let fixtures: Vec<Value> = serde_json::from_str(include_str!(
        "../docs/proposals/managed-agents-fixtures.json"
    ))
    .unwrap();
    for fixture in fixtures {
        let body = fixture["value"].clone();
        let accepted = match fixture["schema"].as_str().unwrap() {
            "SendAgentRequest" => {
                serde_json::from_value::<SendAgentRequest>(body).is_ok_and(|v| v.validate().is_ok())
            }
            "ExecutionConfiguration" => serde_json::from_value::<ExecutionConfiguration>(body)
                .is_ok_and(|v| v.validate().is_ok()),
            "TeamManagedApprovalPage" => beeteam::dto::contracts::validate_schema(
                &document,
                &document["components"]["schemas"]["TeamManagedApprovalPage"],
                &body,
            )
            .is_ok(),
            _ => continue,
        };
        assert_eq!(accepted, fixture["valid"].as_bool().unwrap(), "{fixture}");
    }
}

#[test]
fn accepts_requests_without_provider_session_identifiers() {
    let request: SendAgentRequest =
        serde_json::from_value(json!({"content":"Review the implementation"})).unwrap();
    request.validate().unwrap();
    for field in [
        "bindingId",
        "sessionId",
        "externalId",
        "harness",
        "executorAgentId",
        "expectedBindingId",
    ] {
        let mut body = json!({"content":"Review"});
        body[field] = Value::String("external-chat".into());
        assert!(
            serde_json::from_value::<SendAgentRequest>(body).is_err(),
            "{field}"
        );
    }
}

#[test]
fn enforces_message_bytes_and_uuid_version() {
    for body in [
        json!({"content":" \n"}),
        json!({"content":"🙂".repeat(16385)}),
        json!({"content":"Review", "conversationId":"00000000-0000-4000-8000-000000000001"}),
    ] {
        assert!(serde_json::from_value::<SendAgentRequest>(body)
            .unwrap()
            .validate()
            .is_err());
    }
    serde_json::from_value::<SendAgentRequest>(json!({"content":"🙂".repeat(16384)}))
        .unwrap()
        .validate()
        .unwrap();
}

#[test]
fn configuration_accepts_only_supported_owned_runtime_settings() {
    let valid = json!({"provider":"codex", "toolProfile":{"webSearch":"live","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
    serde_json::from_value::<ExecutionConfiguration>(valid.clone())
        .unwrap()
        .validate()
        .unwrap();
    for (key, value) in [
        ("externalId", json!("desktop-thread")),
        ("provider", json!("claude-code")),
    ] {
        let mut body = valid.clone();
        body[key] = value;
        assert!(serde_json::from_value::<ExecutionConfiguration>(body).is_err());
    }
    let mut relative = valid;
    relative["projectRoot"] = json!("../project");
    assert!(serde_json::from_value::<ExecutionConfiguration>(relative).is_err());
}

#[test]
fn configuration_needs_no_project() {
    let config: ExecutionConfiguration = serde_json::from_value(json!({"provider":"codex","toolProfile":{"webSearch":"live","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}})).unwrap();
    config.validate().unwrap();
}

#[test]
fn workspace_cannot_be_selected_by_callers() {
 let base=json!({"provider":"codex","toolProfile":{"webSearch":"live","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]}});
 serde_json::from_value::<ExecutionConfiguration>(base.clone()).unwrap().validate().unwrap();
 for path in ["", "C:/project", "/tmp/project"] {
  let mut body=base.clone();body["projectRoot"]=json!(path);
  assert!(serde_json::from_value::<ExecutionConfiguration>(body).is_err());
 }
}
