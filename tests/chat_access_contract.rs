use beeteam::dto::{leader_chat::SendMessage, managed_agents::SendAgentRequest};
use serde_json::json;
use uuid::Uuid;

#[test]
fn access_modes_are_accepted_by_both_chat_requests_and_default_to_standard() {
    let binding = Uuid::now_v7();
    let message = Uuid::now_v7();
    for mode in ["read_only", "standard", "full_access", "codex_config"] {
        let legacy =
            json!({"bindingId":binding,"clientMessageId":message,"content":"hi","accessMode":mode});
        let managed = json!({"content":"hi","accessMode":mode});
        assert!(serde_json::from_value::<SendMessage>(legacy).is_ok());
        assert!(serde_json::from_value::<SendAgentRequest>(managed).is_ok());
    }
    let legacy: SendMessage = serde_json::from_value(
        json!({"bindingId":binding,"clientMessageId":message,"content":"hi"}),
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(legacy).unwrap()["accessMode"],
        "standard"
    );
    let managed: SendAgentRequest = serde_json::from_value(json!({"content":"hi"})).unwrap();
    assert!(serde_json::from_value::<SendAgentRequest>(
        json!({"content":"hi","accessMode":"root"})
    )
    .is_err());
    assert!(serde_json::from_value::<SendMessage>(
        json!({"bindingId":binding,"clientMessageId":message,"content":"hi","accessMode":"root"})
    )
    .is_err());
    assert_eq!(
        serde_json::to_value(managed).unwrap().get("accessMode"),
        None
    );
}
