use beeteam::{
    dto::backend::Command,
    repositories::records::{Record, Records},
    services::leader_chat::rules,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use uuid::Uuid;
fn cmd(op: &str, body: Value) -> Command {
    Command {
        operation: op.into(),
        body,
        params: BTreeMap::new(),
        query: BTreeMap::new(),
        actor: None,
        expected_version: None,
        idempotency_key: None,
        upload: None,
    }
}
#[test]
fn external_bindings_are_not_adopted_and_message_retries_do_not_create_turns() {
    let mut records = Records::default();
    let agent = records.insert(Record::new("agents", json!({})));
    let team = records.insert(Record::new("teams", json!({"leaderId":agent})));
    let binding = records.insert(Record::new(
        "agent_session_bindings",
        json!({"agentId":agent,"endedAt":null}),
    ));
    let create = cmd(
        "integrated:create",
        json!({"teamId":team,"leaderAgentId":agent,"bindingId":binding,"title":"Chat"}),
    );
    assert_eq!(
        rules::create(&mut records, &create).unwrap_err().code,
        "external_mode"
    );
    records
        .get_mut("agent_session_bindings", binding)
        .unwrap()
        .data["mode"] = json!("integrated");
    let chat = rules::create(&mut records, &create)
        .unwrap()
        .created_id
        .unwrap();
    let mut send = cmd(
        "integrated:send",
        json!({"clientMessageId":Uuid::new_v4(),"bindingId":binding,"content":"hello"}),
    );
    send.params.insert("chatId".into(), chat.to_string());
    let first = rules::send(&mut records, &send).unwrap();
    let second = rules::send(&mut records, &send).unwrap();
    assert_eq!(first.data, second.data);
    assert_eq!(records.list("leader_chat_turns").len(), 1);
    send.body["clientMessageId"] = json!(Uuid::new_v4());
    assert_eq!(
        rules::send(&mut records, &send).unwrap_err().code,
        "turn_in_progress"
    );
}

#[test]
fn uncertain_cancellation_preserves_diagnostic_and_does_not_claim_delivery() {
    let mut records = Records::default();
    let chat = Uuid::now_v7();
    let turn = records.insert(Record::new(
        "leader_chat_turns",
        json!({"chatId":chat,"status":"uncertain","failure":{"code":"process_restarted"}}),
    ));
    let original = records.get("leader_chat_turns", turn).unwrap().clone();
    let mut request = cmd("integrated:cancel", Value::Null);
    request.params.insert("chatId".into(), chat.to_string());
    request.params.insert("turnId".into(), turn.to_string());
    request.expected_version = Some(1);
    assert_eq!(
        rules::cancel(&mut records, &request).unwrap_err().code,
        "reconciliation_required"
    );
    assert_eq!(records.get("leader_chat_turns", turn).unwrap(), &original);
    assert!(records.list("leader_chat_events").is_empty());
}
