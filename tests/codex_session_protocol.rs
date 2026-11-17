use beeteam::repositories::codex_session::Protocol;
use serde_json::json;

#[test]
fn acknowledgements_are_distinct_from_completion_and_other_threads_are_ignored() {
    let mut protocol = Protocol::new("owned-thread");
    assert!(protocol
        .accept(&json!({"id":3,"result":{"turn":{"id":"turn-1"}}}))
        .unwrap()
        .is_some());
    assert!(protocol.accept(&json!({"method":"turn/completed","params":{"threadId":"other-thread","turn":{"id":"turn-1","status":"completed"}}})).unwrap().is_none());
    assert!(protocol.accept(&json!({"method":"item/completed","params":{"threadId":"owned-thread","item":{"type":"agentMessage","text":"reply"}}})).unwrap().is_none());
    assert!(protocol.accept(&json!({"method":"item/completed","params":{"threadId":"owned-thread","item":{"type":"agentMessage","phase":"commentary","text":"intermediate progress"}}})).unwrap().is_none());
    let result=protocol.accept(&json!({"method":"turn/completed","params":{"threadId":"owned-thread","turn":{"id":"turn-1","status":"completed"}}})).unwrap();
    assert_eq!(
        result,
        Some(beeteam::dto::session_delivery::SessionEvent::Completed {
            turn_id: "turn-1".into(),
            text: "reply".into()
        })
    );
}

#[test]
fn failed_and_mismatched_turns_never_become_success() {
    let mut protocol = Protocol::new("owned-thread");
    protocol
        .accept(&json!({"id":3,"result":{"turn":{"id":"turn-1"}}}))
        .unwrap();
    assert!(protocol.accept(&json!({"method":"turn/completed","params":{"threadId":"owned-thread","turn":{"id":"other","status":"completed"}}})).is_err());
    assert!(protocol.accept(&json!({"method":"turn/completed","params":{"threadId":"owned-thread","turn":{"id":"turn-1","status":"failed"}}})).is_err());
}
