use crate::{
    config::AppConfig,
    dto::{backend::Failure, voice::*},
    state::AppState,
};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
};

pub fn router(config: &AppConfig) -> Router<AppState> {
    Router::new()
        .route("/api/v2/voice/voices", get(voices))
        .route("/api/v2/voice/sessions", post(create))
        .route("/api/v2/voice/sessions/{id}", delete(stop))
        .route("/api/v2/voice/sessions/{id}/events", get(events))
        .route("/api/v2/voice/sessions/{id}/results", post(result))
        .route("/api/v2/voice/sessions/{id}/context", post(context))
        .layer(axum::middleware::from_fn_with_state(
            super::local_access::Policy::new(config, true),
            super::local_access::enforce,
        ))
}
fn failure(error: Failure) -> Response {
    let status = match error.code.as_str() {
        "not_found" => StatusCode::NOT_FOUND,
        "invalid_request" => StatusCode::BAD_REQUEST,
        _ => StatusCode::SERVICE_UNAVAILABLE,
    };
    (status, Json(error)).into_response()
}
async fn voices(State(state): State<AppState>) -> Response {
    match state.voice().voices().await {
        Ok(value) => ([(header::CACHE_CONTROL, "no-store")], Json(value)).into_response(),
        Err(error) => failure(error),
    }
}
async fn create(State(state): State<AppState>, Json(body): Json<StartVoice>) -> Response {
    let response = match state.voice().create(body).await {
        Ok(value) => Json(value).into_response(),
        Err(error) => failure(error),
    };
    ([(header::CACHE_CONTROL, "no-store")], response).into_response()
}
async fn events(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(cursor): Query<VoiceCursor>,
) -> Response {
    match state.voice().events(id, cursor.after).await {
        Ok(value) => ([(header::CACHE_CONTROL, "no-store")], Json(value)).into_response(),
        Err(error) => failure(error),
    }
}
async fn result(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<VoiceResult>,
) -> Response {
    match state.voice().result(id, body).await {
        Ok(()) => Json(serde_json::json!({})).into_response(),
        Err(error) => failure(error),
    }
}
async fn context(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<VoiceContext>,
) -> Response {
    match state.voice().context(id, body).await {
        Ok(()) => Json(serde_json::json!({})).into_response(),
        Err(error) => failure(error),
    }
}
async fn stop(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    match state.voice().stop(id).await {
        Ok(()) => Json(serde_json::json!({})).into_response(),
        Err(error) => failure(error),
    }
}
