use crate::{dto::api_info::ApiInfo, state::AppState};
use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderValue},
    Json,
};
use utoipa_axum::{router::OpenApiRouter, routes};

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(get_info))
}

#[utoipa::path(
    get,
    path = "/api/v1/info",
    summary = "Discover installed API version and enabled capabilities",
    description = "Public read-only discovery, independent of database availability. apiVersion is the installed software version; supportedContractVersions identifies HTTP contracts. capabilities lists stable enabled identifiers, not authorization or resource existence. Ignore unknown identifiers. A legacy 404 means unknown compatibility; transport/server errors remain unavailability. No private configuration is exposed. Local project actions still require local peer/origin/header checks.",
    responses((status = 200, description = "Installed compatibility information (Cache-Control: no-store)", body = ApiInfo))
)]
async fn get_info(State(state): State<AppState>) -> (HeaderMap, Json<ApiInfo>) {
    let mut headers = HeaderMap::new();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    (headers, Json(state.api_info().info()))
}
