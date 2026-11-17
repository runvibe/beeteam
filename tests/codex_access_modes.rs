use beeteam::{dto::access_mode::AccessMode, repositories::codex_access::turn_overrides};
use serde_json::json;

#[test]
fn named_modes_override_every_turn_and_preserve_network_restriction() {
    let standard = turn_overrides(AccessMode::Standard, false, None).unwrap();
    assert_eq!(standard["approvalPolicy"], "on-request");
    assert_eq!(standard["sandboxPolicy"]["type"], "workspaceWrite");
    assert_eq!(standard["sandboxPolicy"]["networkAccess"], false);
    let read = turn_overrides(AccessMode::ReadOnly, true, None).unwrap();
    assert_eq!(read["sandboxPolicy"]["type"], "readOnly");
    assert_eq!(read["approvalPolicy"], "on-request");
    let full = turn_overrides(AccessMode::FullAccess, false, None).unwrap();
    assert_eq!(
        full,
        json!({"approvalPolicy":"never","sandboxPolicy":{"type":"dangerFullAccess"}})
    );
}

#[test]
fn codex_config_preserves_the_native_effective_policy_and_rejects_bad_data() {
    let root = std::env::current_dir()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    let native = json!({"approvalPolicy":"never","sandbox":{"type":"workspaceWrite","writableRoots":[root],"networkAccess":true,"excludeTmpdirEnvVar":true,"excludeSlashTmp":true}});
    let overrides = turn_overrides(AccessMode::CodexConfig, false, Some(&native)).unwrap();
    assert_eq!(overrides["approvalPolicy"], native["approvalPolicy"]);
    assert_eq!(overrides["sandboxPolicy"], native["sandbox"]);
    assert!(turn_overrides(AccessMode::CodexConfig, false, None).is_err());
    assert!(turn_overrides(
        AccessMode::CodexConfig,
        false,
        Some(&json!({"sandbox":{"type":"new"},"approvalPolicy":"never"}))
    )
    .is_err());
    assert!(turn_overrides(AccessMode::CodexConfig, false, Some(&json!({"sandbox":{"type":"workspaceWrite","networkAccess":"yes"},"approvalPolicy":"never"}))).is_err());
    assert!(turn_overrides(AccessMode::CodexConfig, false, Some(&json!({"sandbox":{"type":"readOnly","networkAccess":false},"approvalPolicy":{"granular":{"rules":true,"sandbox_approval":true,"mcp_elicitations":true},"unknown":true}}))).is_err());
}

#[test]
fn codex_config_preserves_granular_approval_and_external_sandbox() {
    let native = json!({
        "approvalPolicy":{"granular":{"mcp_elicitations":true,"rules":false,"sandbox_approval":true,"request_permissions":true,"skill_approval":false}},
        "sandbox":{"type":"externalSandbox","networkAccess":"restricted"}
    });
    let overrides = turn_overrides(AccessMode::CodexConfig, true, Some(&native)).unwrap();
    assert_eq!(overrides["approvalPolicy"], native["approvalPolicy"]);
    assert_eq!(overrides["sandboxPolicy"], native["sandbox"]);
}
