use axum::Router;
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use tower_http::limit::RequestBodyLimitLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{config::AppConfig, state::AppState};

pub mod backend;
mod changes;
mod cors;
mod data_transfer;
#[cfg(feature = "mcp")]
mod data_transfer_mcp;
mod frontend;
#[cfg(feature = "mcp")]
mod integrated_chat_mcp;
mod leader_chat;
mod local_access;
mod local_projects;
mod managed_agents;
#[cfg(feature = "mcp")]
mod managed_agents_mcp;
#[cfg(feature = "mcp")]
pub mod mcp;
#[cfg(feature = "mcp")]
mod mcp_adapter;
#[cfg(feature = "mcp")]
mod mcp_materials;
pub mod system;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Bee Team",
        description = "Bee Team local service: system endpoints. Kanban and RA contracts are separate documents.",
        version = env!("CARGO_PKG_VERSION"),
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0.html")
    )
)]
struct ApiDoc;

pub fn create_router(state: AppState, config: &AppConfig) -> Router {
    create_router_with_frontend(
        state,
        config,
        crate::services::frontend::FrontendMode::default(),
    )
}
pub fn create_router_with_frontend(
    state: AppState,
    config: &AppConfig,
    mode: crate::services::frontend::FrontendMode,
) -> Router {
    let state = state.with_leader_chat_runtime(config).with_api_info(
        cfg!(feature = "mcp") && config.mcp.enabled,
        config.host.is_loopback(),
    );
    let (api_router, api) = utoipa_axum::router::OpenApiRouter::with_openapi(ApiDoc::openapi())
        .merge(system::router())
        .split_for_parts();

    let api_router = api_router
        .layer(RequestBodyLimitLayer::new(config.body_limit_bytes))
        .merge(
            SwaggerUi::new("/docs")
                .url("/openapi.json", api)
                .external_url_unchecked(
                    "/openapi/kanban.json",
                    crate::dto::contracts::operation("getTask")
                        .unwrap()
                        .document
                        .clone(),
                )
                .external_url_unchecked(
                    "/openapi/ra.json",
                    crate::dto::contracts::operation("getAgent")
                        .unwrap()
                        .document
                        .clone(),
                )
                .external_url_unchecked(
                    "/openapi/data-transfer.json",
                    serde_json::from_str::<serde_json::Value>(include_str!(
                        "../../docs/data-transfer-openapi.json"
                    ))
                    .expect("bundled transfer OpenAPI"),
                )
                .external_url_unchecked(
                    "/openapi/local-projects.json",
                    serde_json::from_str::<serde_json::Value>(include_str!(
                        "../../docs/local-projects-openapi.json"
                    ))
                    .expect("bundled local projects OpenAPI"),
                ),
        )
        .merge(backend::router(config.body_limit_bytes))
        .merge(changes::router())
        .merge(leader_chat::router(config))
        .merge(managed_agents::router(config))
        .merge(local_projects::router(config.host.is_loopback()))
        .merge(data_transfer::router(state.clone()));

    let api_router = if config.otel_enabled {
        api_router
            .layer(OtelInResponseLayer::default())
            .layer(OtelAxumLayer::default().filter(|path| path != "/health"))
    } else {
        api_router
    };

    let api_router = api_router.layer(cors::build_cors_layer(&config.cors, None));

    #[cfg(feature = "mcp")]
    let api_router = if config.mcp.enabled {
        api_router.merge(mcp::router(&config.mcp, state.clone()).layer(
            axum::middleware::from_fn_with_state(state.clone(), data_transfer::origin),
        ))
    } else {
        api_router
    };

    let api_router = if state.leader_chat().is_configured() {
        api_router.layer(axum::middleware::from_fn_with_state(
            local_access::Policy::new(config, true),
            local_access::enforce,
        ))
    } else {
        api_router
    };

    let api_router = if mode == crate::services::frontend::FrontendMode::Embedded {
        let mcp_path = config.mcp.path.clone();
        api_router.fallback(move |method, uri, headers| {
            frontend::respond(method, uri, headers, mcp_path.clone())
        })
    } else {
        api_router
    };
    api_router.with_state(state)
}
