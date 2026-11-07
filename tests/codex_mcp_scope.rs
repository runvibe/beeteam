use beeteam::repositories::codex_mcp_scope::McpScope;
use serde_json::json;
#[test]
fn pagination_is_explicit_and_never_assumed_complete() {
    use beeteam::repositories::codex_mcp_scope::inventory_cursor;
    assert!(inventory_cursor(&json!({"data":[]})).is_err());
    assert!(inventory_cursor(&json!({"nextCursor":42})).is_err());
    assert!(inventory_cursor(&json!({"nextCursor":""})).is_err());
    assert_eq!(inventory_cursor(&json!({"nextCursor":null})).unwrap(),None);
    assert_eq!(inventory_cursor(&json!({"nextCursor":"page-2"})).unwrap(),Some("page-2"));
}
fn own() -> serde_json::Value {
    json!({"name":"owned_bee","httpOrigin":"http://127.0.0.1:59869","runtimeStatus":"connected","toolsError":null,"tools":{"getTask":{},"createComment":{},"createExecutionSummary":{}}})
}
#[test]
fn managed_scope_disables_inherited_servers_without_copying_credentials() {
    let mut scope = McpScope::new("http://127.0.0.1:59869/mcp", "owned_bee").unwrap();
    scope
        .observe(&[
            json!({"name":"beeteam","pluginId":null}),
            json!({"name":"codex_apps","pluginId":null}),
            json!({"name":"codex_app","pluginId":"codex-app-tools@openai-bundled"}),
        ])
        .unwrap();
    let config = scope.configuration();
    assert_eq!(config["mcp_servers"]["beeteam"]["enabled"], false);
    assert!(config["mcp_servers"].get("codex_apps").is_none());
    assert_eq!(
        config["plugins"]["codex-app-tools@openai-bundled"]["enabled"],
        false
    );
    assert_eq!(
        config["mcp_servers"]["owned_bee"]["url"],
        "http://127.0.0.1:59869/mcp"
    );
}
#[test]
fn a_foreign_bee_team_or_chat_tool_never_passes_preflight() {
    let scope = McpScope::new("http://127.0.0.1:59869/mcp", "owned_bee").unwrap();
    let foreign = json!({"name":"other","pluginId":"plugin","runtimeStatus":"connected","toolsError":null,"tools":{"createComment":{}}});
    assert!(scope.verify(&[own(), foreign]).is_err());
    let foreign = json!({"name":"other","pluginId":"plugin","runtimeStatus":"connected","toolsError":null,"tools":{"send_message_to_thread":{}}});
    assert!(scope.verify(&[own(), foreign]).is_err());
    let mut wrong = own();
    wrong["httpOrigin"] = json!("http://127.0.0.1:59865");
    assert!(scope.verify(&[wrong]).is_err());
}
#[test]
fn only_a_verified_local_managed_origin_can_be_used() {
    assert!(McpScope::new("https://example.com/mcp", "owned").is_err());
    let scope = McpScope::new("http://127.0.0.1:59869/mcp", "owned_bee").unwrap();
    assert!(scope
        .verify(&[
            own(),
            json!({"name":"beeteam","runtimeStatus":"disabled","tools":{}})
        ])
        .is_ok());
    let unrelated = json!({"name":"data","pluginId":"data-plugin","runtimeStatus":"connected","toolsError":null,"tools":{"analyze_data":{}}});
    assert!(scope.verify(&[own(), unrelated]).is_ok());
}
