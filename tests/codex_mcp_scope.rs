use beeteam::repositories::codex_mcp_scope::McpScope;
use serde_json::json;

#[test]
fn integrated_profile_enables_web_and_network_without_full_access() {
    use beeteam::repositories::codex_mcp_scope::CodexToolProfile;
    let scope = McpScope::with_tools(
        "http://127.0.0.1:59869/mcp",
        "owned_bee",
        CodexToolProfile::default(),
    )
    .unwrap();
    let config = scope.configuration();
    assert_eq!(config["web_search"], "live");
    assert_eq!(config["sandbox_workspace_write.network_access"], true);
    assert!(config.get("approval_policy").is_none());
    assert!(config.get("sandbox_mode").is_none());
}

#[test]
fn selected_mcp_is_preserved_but_foreign_bee_tools_remain_rejected() {
    use beeteam::repositories::codex_mcp_scope::CodexToolProfile;
    let profile = CodexToolProfile {
        enabled_mcp_servers: vec!["docs".into()],
        ..Default::default()
    };
    let mut scope =
        McpScope::with_tools("http://127.0.0.1:59869/mcp", "owned_bee", profile).unwrap();
    let docs = json!({"name":"docs","httpOrigin":"https://docs.example.com","runtimeStatus":"connected","toolsError":null,"tools":{"search_docs":{}}});
    scope
        .observe(&[docs.clone(), json!({"name":"unselected"})])
        .unwrap();
    assert!(scope.configuration()["mcp_servers"].get("docs").is_none());
    assert_eq!(
        scope.configuration()["mcp_servers"]["unselected"]["enabled"],
        false
    );
    assert!(scope.verify(&[own(), docs.clone()]).is_ok());
    let mut malicious = docs;
    malicious["tools"] = json!({"createComment":{}});
    assert!(scope.verify(&[own(), malicious]).is_err());
}

#[test]
fn selected_mcp_must_be_present_and_connected() {
    use beeteam::repositories::codex_mcp_scope::CodexToolProfile;
    let profile = CodexToolProfile {
        enabled_mcp_servers: vec!["docs".into()],
        ..Default::default()
    };
    let mut scope =
        McpScope::with_tools("http://127.0.0.1:59869/mcp", "owned_bee", profile).unwrap();
    assert!(scope.observe(&[]).is_err());
    assert!(scope.verify(&[own()]).is_err());
    assert!(scope
        .verify(&[
            own(),
            json!({"name":"docs","runtimeStatus":"disabled","tools":{}})
        ])
        .is_err());
}

#[test]
fn integrated_profile_rejects_invalid_roots_and_mcp_names() {
    use beeteam::repositories::codex_mcp_scope::CodexToolProfile;
    for profile in [
        CodexToolProfile {
            web_search: "invented".into(),
            ..Default::default()
        },
        CodexToolProfile {
            skill_roots: vec!["relative".into()],
            ..Default::default()
        },
        CodexToolProfile {
            enabled_mcp_servers: vec!["owned_bee".into()],
            ..Default::default()
        },
    ] {
        assert!(McpScope::with_tools("http://127.0.0.1:59869/mcp", "owned_bee", profile).is_err());
    }
}

#[test]
fn plugin_selection_cannot_silently_enable_unselected_sibling_servers() {
    use beeteam::repositories::codex_mcp_scope::CodexToolProfile;
    let inventory = [
        json!({"name":"docs","pluginId":"docs-plugin"}),
        json!({"name":"files","pluginId":"docs-plugin"}),
    ];
    let profile = CodexToolProfile {
        enabled_mcp_servers: vec!["docs".into()],
        ..Default::default()
    };
    let mut scope =
        McpScope::with_tools("http://127.0.0.1:59869/mcp", "owned_bee", profile).unwrap();
    assert!(scope.observe(&inventory).is_err());
    let profile = CodexToolProfile {
        enabled_mcp_servers: vec!["docs".into(), "files".into()],
        ..Default::default()
    };
    let mut scope =
        McpScope::with_tools("http://127.0.0.1:59869/mcp", "owned_bee", profile).unwrap();
    scope.observe(&inventory).unwrap();
    assert_eq!(
        scope.configuration()["plugins"]["docs-plugin"]["enabled"],
        true
    );
    assert!(scope.disabled_plugins(&inventory).is_empty());
}

#[test]
fn integrated_profile_can_disable_network_and_retains_explicit_skill_roots() {
    use beeteam::repositories::codex_mcp_scope::CodexToolProfile;
    let root = std::env::current_dir()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    let profile = CodexToolProfile {
        web_search: "disabled".into(),
        network_access: false,
        skill_roots: vec![root.clone()],
        ..Default::default()
    };
    let scope = McpScope::with_tools("http://127.0.0.1:59869/mcp", "owned_bee", profile).unwrap();
    assert_eq!(scope.configuration()["web_search"], "disabled");
    assert_eq!(
        scope.configuration()["sandbox_workspace_write.network_access"],
        false
    );
    assert_eq!(scope.skill_roots(), &[root]);
    let unexpected = json!({"name":"unexpected","pluginId":"p","runtimeStatus":"connected","toolsError":null,"tools":{"search":{}}});
    assert!(scope.verify(&[own(), unexpected]).is_err());
}
#[test]
fn pagination_is_explicit_and_never_assumed_complete() {
    use beeteam::repositories::codex_mcp_scope::inventory_cursor;
    assert!(inventory_cursor(&json!({"data":[]})).is_err());
    assert!(inventory_cursor(&json!({"nextCursor":42})).is_err());
    assert!(inventory_cursor(&json!({"nextCursor":""})).is_err());
    assert_eq!(inventory_cursor(&json!({"nextCursor":null})).unwrap(), None);
    assert_eq!(
        inventory_cursor(&json!({"nextCursor":"page-2"})).unwrap(),
        Some("page-2")
    );
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
