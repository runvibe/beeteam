#![cfg(unix)]

use beeteam::{
    dto::{access_mode::AccessMode, session_delivery::SessionDestination},
    repositories::{
        codex_integrated::CodexIntegratedProvider,
        codex_mcp_scope::CodexToolProfile,
        integrated_provider::{IntegratedEvent, IntegratedProvider, ToolSource},
    },
};
use serde_json::{json, Value};
use std::path::PathBuf;
use tokio::sync::mpsc;

async fn run(
    mode: AccessMode,
    invalid: bool,
    defaults: bool,
) -> (Result<(), String>, Vec<IntegratedEvent>) {
    let scenario = if invalid {
            "codex-access-invalid"
        } else if defaults {
            "codex-access-defaults"
        } else {
            "codex-access-valid"
        };
    run_scenario(Some(mode), scenario).await
}

async fn run_scenario(mode: Option<AccessMode>, scenario: &str) -> (Result<(), String>, Vec<IntegratedEvent>) {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join(".local")
        .join(scenario);
    std::fs::create_dir_all(&root).unwrap();
    let provider = CodexIntegratedProvider {
        executable: PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/fake_codex_access.py"),
        mcp_endpoint: "http://127.0.0.1:59869/mcp".into(),
        profile: CodexToolProfile::default(),
    };
    let target = SessionDestination {
        harness: "codex".into(),
        installation_id: "test".into(),
        external_id: "thread".into(),
        project_root: root.to_string_lossy().into(),
    };
    let profile = json!({"webSearch":"disabled","networkAccess":false,"enabledMcpServers":[],"skillRoots":[]});
    let (tx, mut rx) = mpsc::channel(16);
    let (_control_tx, control_rx) = mpsc::channel(2);
    let result = provider
        .run(&target, "test", "Bee Team managed guidance", &profile, ToolSource::Configured, mode, tx, control_rx)
        .await
        .map_err(|e| e.code.to_string());
    let mut events = Vec::new();
    while let Ok(event) = rx.try_recv() {
        events.push(event);
    }
    (result, events)
}

#[tokio::test]
async fn legacy_turn_does_not_override_policy() {
    let (result, _) = run_scenario(None, "codex-access-legacy").await;
    assert!(result.is_ok(), "{result:?}");
}

#[tokio::test]
async fn resumed_managed_thread_receives_guidance_and_preserves_user_developer_instructions() {
    let (result, events) = run_scenario(None, "codex-access-guidance").await;
    result.unwrap();
    let response = events.iter().find_map(|event| match event {
        IntegratedEvent::Text(text) => Some(serde_json::from_str::<Value>(text).unwrap()),
        _ => None,
    }).unwrap();
    let instructions = response["developerInstructions"].as_str().expect("managed guidance missing");
    assert!(instructions.contains("Bee Team"));
    assert!(instructions.contains("Existing user instructions"));
}

#[tokio::test]
async fn every_turn_receives_its_own_policy_and_config_is_resolved_without_thread_overrides() {
    for (mode, sandbox, approval) in [
        (AccessMode::FullAccess, "dangerFullAccess", "never"),
        (AccessMode::ReadOnly, "readOnly", "on-request"),
        (AccessMode::Standard, "workspaceWrite", "on-request"),
        (AccessMode::CodexConfig, "workspaceWrite", "never"),
    ] {
        let (result, events) = run(mode, false, false).await;
        result.unwrap();
        let response = events
            .iter()
            .find_map(|e| match e {
                IntegratedEvent::Text(text) => Some(serde_json::from_str::<Value>(text).unwrap()),
                _ => None,
            })
            .unwrap();
        assert_eq!(response["sandboxPolicy"]["type"], sandbox);
        assert_eq!(response["approvalPolicy"], approval);
        assert_eq!(response["approvalsReviewer"], "auto_review");
        if mode == AccessMode::Standard {
            assert_eq!(response["sandboxPolicy"]["networkAccess"], false);
        }
        if mode == AccessMode::CodexConfig {
            assert!(response["resumeConfig"].get("sandbox_workspace_write.network_access").is_none());
            assert_eq!(response["sandboxPolicy"]["networkAccess"], true);
            assert_eq!(response["sandboxPolicy"]["excludeSlashTmp"], true);
            assert_eq!(response["sandboxPolicy"]["excludeTmpdirEnvVar"], true);
            assert_eq!(
                response["sandboxPolicy"]["writableRoots"]
                    .as_array()
                    .unwrap()
                    .len(),
                1
            );
        }
    }
}

#[tokio::test]
async fn config_read_failure_never_submits_a_turn() {
    let (result, events) = run(AccessMode::CodexConfig, true, false).await;
    assert_eq!(result.unwrap_err(), "codex_config_invalid");
    assert!(events.is_empty());
}

#[tokio::test]
async fn guidance_config_failure_never_submits_a_legacy_turn() {
    let (result, events) = run_scenario(None, "codex-access-invalid").await;
    assert_eq!(result.unwrap_err(), "codex_config_invalid");
    assert!(events.is_empty());
}

#[tokio::test]
async fn malformed_developer_instructions_never_submit_a_turn() {
    let (result, events) = run_scenario(None, "codex-access-malformed").await;
    assert_eq!(result.unwrap_err(), "codex_config_invalid");
    assert!(events.is_empty());
}

#[tokio::test]
async fn missing_project_during_config_resolution_never_submits_a_turn() {
    let (result, events) = run_scenario(Some(AccessMode::CodexConfig), "codex-access-removed").await;
    assert_eq!(result.unwrap_err(), "codex_config_invalid");
    assert!(events.is_empty());
}

#[tokio::test]
async fn empty_codex_config_restores_native_defaults_after_explicit_full_access() {
    let (first, _) = run(AccessMode::FullAccess, false, true).await;
    first.unwrap();
    let (result, events) = run(AccessMode::CodexConfig, false, true).await;
    result.unwrap();
    let policy = events
        .iter()
        .find_map(|e| match e {
            IntegratedEvent::Text(text) => Some(serde_json::from_str::<Value>(text).unwrap()),
            _ => None,
        })
        .unwrap();
    assert_eq!(policy["approvalPolicy"], "on-request");
    assert_eq!(
        policy["sandboxPolicy"],
        json!({"type":"readOnly","networkAccess":false})
    );
}
