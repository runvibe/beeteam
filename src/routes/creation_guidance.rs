use crate::{
    dto::{backend::Failure, creation_guidance::CreationGuidanceRequest},
    state::AppState,
};
use axum::{
    extract::{rejection::QueryRejection, Query, State},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};

pub fn router() -> Router<AppState> {
    Router::new().route("/api/v1/creation-guidance", get(guidance))
}

async fn guidance(
    State(state): State<AppState>,
    request: Result<Query<CreationGuidanceRequest>, QueryRejection>,
) -> Response {
    let result = request
        .map_err(|e| Failure::invalid(e.body_text()))
        .and_then(|Query(request)| state.creation_guidance().get(request));
    match result {
        Ok(value) => Json(value).into_response(),
        Err(error) => super::backend::failure(error),
    }
}
