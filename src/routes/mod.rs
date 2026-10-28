use axum::Router;
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use tower_http::limit::RequestBodyLimitLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::{config::AppConfig, state::AppState};

pub mod backend;
mod changes;
mod cors;
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
        title = env!("CARGO_PKG_NAME"),
        description = "Bee Team local service: system endpoints. Kanban and RA contracts are separate documents.",
        version = env!("CARGO_PKG_VERSION"),
        license(name = "Apache-2.0", url = "https://www.apache.org/licenses/LICENSE-2.0.html")
    )
)]
struct ApiDoc;

pub fn create_router(state: AppState, config: &AppConfig) -> Router {
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
                ),
        )
        .merge(backend::router(config.body_limit_bytes))
        .merge(changes::router());

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
        api_router.merge(mcp::router(&config.mcp, state.clone()))
    } else {
        api_router
    };

    api_router.with_state(state)
}
