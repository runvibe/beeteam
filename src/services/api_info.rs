//! Compatibility policy independent of HTTP, storage and deployment paths.
use crate::dto::api_info::ApiInfo;

#[derive(Clone)]
pub struct ApiInfoService {
    info: ApiInfo,
}
impl ApiInfoService {
    pub fn new(mcp_enabled: bool, transfer_enabled: bool, local_projects_enabled: bool) -> Self {
        let mut capabilities = vec![
            "agents.latest-activity",
            "teams.role-icons",
            "tasks.execution-intervals",
            "tasks.timeline-points",
            "tasks.participants",
            "tasks.work-scope",
        ];
        if mcp_enabled {
            capabilities.push("mcp");
        }
        if transfer_enabled {
            capabilities.push("data-transfer");
        }
        if local_projects_enabled {
            capabilities.push("local-projects.open");
        }
        capabilities.sort_unstable();
        Self {
            info: ApiInfo {
                api_version: env!("CARGO_PKG_VERSION").into(),
                supported_contract_versions: vec!["v1".into()],
                capabilities: capabilities.into_iter().map(str::to_owned).collect(),
            },
        }
    }
    pub fn info(&self) -> ApiInfo {
        self.info.clone()
    }
}
