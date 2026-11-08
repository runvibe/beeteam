use std::sync::Arc;

use crate::repositories::database::DatabaseRepository;

#[derive(Clone)]
pub struct AppState {
    inner: Arc<SharedState>,
    api_info: crate::services::api_info::ApiInfoService,
    transfers: Option<Arc<crate::services::data_transfer::service::TransferService>>,
    leader_chat: crate::services::leader_chat::LeaderChatService,
}

struct SharedState {
    backend: crate::services::backend::service::BackendService,
    changes: crate::services::changes::ChangeFeed,
    local_projects: crate::services::local_projects::LocalProjectService,
}

impl AppState {
    pub fn leader_chat(&self) -> &crate::services::leader_chat::LeaderChatService {
        &self.leader_chat
    }
    pub fn with_leader_chat_provider(
        mut self,
        provider: Arc<dyn crate::repositories::integrated_provider::IntegratedProvider>,
        installation: String,
    ) -> Self {
        self.leader_chat = self.leader_chat.with_provider(provider, installation);
        self
    }
    pub fn with_leader_chat_runtime(self, config: &crate::config::AppConfig) -> Self {
        if self.leader_chat.is_configured() || !config.host.is_loopback() || !config.mcp.enabled {
            return self;
        }
        match crate::services::managed_sessions::config::ManagedSessionConfig::from_env() {
            Ok(Some(runtime)) => {
                let endpoint = format!("http://{}:{}{}", config.host, config.port, config.mcp.path);
                let provider = crate::repositories::codex_integrated::CodexIntegratedProvider {
                    executable: runtime.executable,
                    mcp_endpoint: endpoint,
                    profile: Default::default(),
                };
                self.with_leader_chat_provider(Arc::new(provider), runtime.installation_id)
            }
            Ok(None) => self,
            Err(error) => {
                tracing::warn!(%error,"Integrated chat unavailable");
                self
            }
        }
    }
    pub fn new(database: DatabaseRepository) -> Self {
        Self::with_project_discovery(
            database,
            Arc::new(crate::repositories::local_git::LocalGitDiscovery::default()),
        )
    }
    pub fn with_project_discovery(
        database: DatabaseRepository,
        discovery: Arc<dyn crate::repositories::contracts::ProjectDiscovery>,
    ) -> Self {
        Self::with_project_adapters(
            database,
            discovery,
            Arc::new(crate::repositories::local_projects::LocalProjectOpener),
        )
    }
    pub fn with_project_adapters(
        database: DatabaseRepository,
        discovery: Arc<dyn crate::repositories::contracts::ProjectDiscovery>,
        opener: Arc<dyn crate::repositories::contracts::ProjectOpener>,
    ) -> Self {
        let (resources, source) = database.stores();
        let changes = crate::services::changes::ChangeFeed::new(source);
        let local_projects =
            crate::services::local_projects::LocalProjectService::new(resources.clone(), opener);
        let leader_chat = crate::services::leader_chat::LeaderChatService::new(resources.clone());
        let backend = crate::services::backend::service::BackendService::new(resources, discovery);
        let inner = SharedState {
            backend,
            changes,
            local_projects,
        };
        Self {
            inner: Arc::new(inner),
            transfers: None,
            leader_chat,
            api_info: crate::services::api_info::ApiInfoService::new(false, false, false),
        }
    }

    /// Compose discovery from the same enabled transport/service state as the router.
    pub(crate) fn with_api_info(mut self, mcp_enabled: bool, local_projects_enabled: bool) -> Self {
        self.api_info = crate::services::api_info::ApiInfoService::new(
            mcp_enabled,
            self.transfers
                .as_ref()
                .is_some_and(|service| service.config.enabled),
            local_projects_enabled,
        );
        self
    }
    pub fn api_info(&self) -> &crate::services::api_info::ApiInfoService {
        &self.api_info
    }

    pub fn with_transfers(
        mut self,
        service: crate::services::data_transfer::service::TransferService,
    ) -> Self {
        self.transfers = Some(Arc::new(service));
        self
    }
    pub fn transfers(
        &self,
    ) -> Option<&Arc<crate::services::data_transfer::service::TransferService>> {
        self.transfers.as_ref()
    }

    pub fn changes(&self) -> &crate::services::changes::ChangeFeed {
        &self.inner.changes
    }

    pub fn backend(&self) -> &crate::services::backend::service::BackendService {
        &self.inner.backend
    }
    /// Explicit local opt-in. Executable and installation never come from requests.
    pub fn managed_session_runtime(
        &self,
        mcp_endpoint: Option<&str>,
    ) -> anyhow::Result<
        Option<(
            Arc<crate::services::managed_sessions::dispatch::ManagedSessionService>,
            crate::repositories::session_dispatch_lease::DispatchLease,
        )>,
    > {
        let Some(config) =
            crate::services::managed_sessions::config::ManagedSessionConfig::from_env()?
        else {
            return Ok(None);
        };
        anyhow::ensure!(
            self.leader_chat.is_configured(),
            "Integrated delivery requires a configured loopback-only chat runtime"
        );
        let mcp_endpoint = mcp_endpoint
            .ok_or_else(|| {
                anyhow::anyhow!("Managed session delivery requires this instance's MCP endpoint")
            })?
            .to_owned();
        let lease = crate::repositories::session_dispatch_lease::DispatchLease::acquire(
            &config.state_dir,
            &config.installation_id,
        )?;
        let backend_origin = mcp_endpoint
            .split('/')
            .take(3)
            .collect::<Vec<_>>()
            .join("/");
        let provider = Arc::new(
            crate::services::leader_chat::worker_delivery::WorkerDeliveryProvider::new(
                self.leader_chat.clone(),
                backend_origin,
            ),
        );
        let service = Arc::new(
            crate::services::managed_sessions::dispatch::ManagedSessionService::new(
                self.inner.backend.resources(),
                provider,
                config.installation_id,
            ),
        );
        Ok(Some((service, lease)))
    }
    pub fn local_projects(&self) -> &crate::services::local_projects::LocalProjectService {
        &self.inner.local_projects
    }
}

#[cfg(test)]
mod tests {
    use sqlx::postgres::PgPoolOptions;

    use super::AppState;
    use crate::repositories::database::DatabaseRepository;

    #[tokio::test]
    async fn state_exposes_backend_service() {
        let pool = PgPoolOptions::new().connect_lazy("postgres://postgres:postgres@localhost/test");
        let repository = DatabaseRepository::new(pool.expect("lazy pool"));
        let state = AppState::new(repository.clone());

        let _ = state.backend();
    }
}
