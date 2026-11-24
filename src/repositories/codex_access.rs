//! Translation of per-turn access policies to the Codex App Server protocol.
use crate::dto::{access_mode::AccessMode, session_delivery::SessionFailure};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
enum Sandbox {
    #[serde(rename = "dangerFullAccess")]
    DangerFullAccess,
    #[serde(rename = "readOnly")]
    ReadOnly {
        #[serde(rename = "networkAccess")]
        _network_access: bool,
    },
    #[serde(rename = "workspaceWrite")]
    WorkspaceWrite {
        #[serde(rename = "writableRoots")]
        _writable_roots: Vec<String>,
        #[serde(rename = "networkAccess")]
        _network_access: bool,
        #[serde(rename = "excludeTmpdirEnvVar")]
        _exclude_tmpdir_env_var: bool,
        #[serde(rename = "excludeSlashTmp")]
        _exclude_slash_tmp: bool,
    },
    #[serde(rename = "externalSandbox")]
    ExternalSandbox {
        #[serde(rename = "networkAccess")]
        _network_access: ExternalNetwork,
    },
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum ExternalNetwork {
    Restricted,
    Enabled,
}

#[derive(Deserialize)]
#[serde(untagged)]
#[allow(dead_code)]
enum Approval {
    Named(NamedApproval),
    Granular(GranularWrapper),
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GranularWrapper {
    #[allow(dead_code)]
    granular: GranularApproval,
}
#[derive(Deserialize)]
enum NamedApproval {
    #[serde(rename = "untrusted")]
    Untrusted,
    #[serde(rename = "on-request")]
    OnRequest,
    #[serde(rename = "never")]
    Never,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GranularApproval {
    #[allow(dead_code)]
    mcp_elicitations: bool,
    #[allow(dead_code)]
    rules: bool,
    #[allow(dead_code)]
    sandbox_approval: bool,
    #[allow(dead_code)]
    #[serde(default)]
    request_permissions: bool,
    #[allow(dead_code)]
    #[serde(default)]
    skill_approval: bool,
}

fn invalid_policy() -> SessionFailure {
    SessionFailure::new(
        "codex_config_invalid",
        "Cannot resolve the effective Codex access policy",
        false,
    )
}

pub fn turn_overrides(
    mode: AccessMode,
    network: bool,
    effective: Option<&Value>,
) -> Result<Value, SessionFailure> {
    Ok(match mode {
        AccessMode::ReadOnly => {
            json!({"approvalPolicy":"on-request","sandboxPolicy":{"type":"readOnly","networkAccess":false}})
        }
        AccessMode::Standard => {
            json!({"approvalPolicy":"on-request","sandboxPolicy":{"type":"workspaceWrite","writableRoots":[],"networkAccess":network,"excludeTmpdirEnvVar":false,"excludeSlashTmp":false}})
        }
        AccessMode::FullAccess => {
            json!({"approvalPolicy":"never","sandboxPolicy":{"type":"dangerFullAccess"}})
        }
        AccessMode::CodexConfig => {
            let effective = effective.ok_or_else(invalid_policy)?;
            let sandbox = effective.get("sandbox").ok_or_else(invalid_policy)?;
            let approval = effective.get("approvalPolicy").ok_or_else(invalid_policy)?;
            let parsed: Sandbox =
                serde_json::from_value(sandbox.clone()).map_err(|_| invalid_policy())?;
            if let Sandbox::WorkspaceWrite {
                _writable_roots, ..
            } = parsed
            {
                if _writable_roots
                    .iter()
                    .any(|root| !std::path::Path::new(root).is_absolute())
                {
                    return Err(invalid_policy());
                }
            }
            let _: Approval =
                serde_json::from_value(approval.clone()).map_err(|_| invalid_policy())?;
            json!({"approvalPolicy":approval,"sandboxPolicy":sandbox})
        }
    })
}
