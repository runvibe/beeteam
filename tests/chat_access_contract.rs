use beeteam::dto::{leader_chat::SendMessage, managed_agents::SendAgentRequest};
use serde_json::json;
use uuid::Uuid;

#[test]
fn access_modes_are_accepted_and_omission_remains_distinct() {
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
    assert!(serde_json::to_value(legacy).unwrap().get("accessMode").is_none());
    let managed: SendAgentRequest = serde_json::from_value(json!({"content":"hi"})).unwrap();
    assert!(serde_json::from_value::<SendAgentRequest>(
        json!({"content":"hi","accessMode":"root"})
    )
    .is_err());
    assert!(serde_json::from_value::<SendAgentRequest>(json!({"content":"hi","accessMode":null})).is_err());
    assert!(serde_json::from_value::<SendMessage>(json!({"bindingId":binding,"clientMessageId":message,"content":"hi","accessMode":null})).is_err());
    assert!(serde_json::from_value::<SendMessage>(
        json!({"bindingId":binding,"clientMessageId":message,"content":"hi","accessMode":"root"})
    )
    .is_err());
    assert_eq!(
        serde_json::to_value(managed).unwrap().get("accessMode"),
        None
    );
}
