use crate::dto::backend::Failure;
use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use thiserror::Error;

pub type ApiResult<T> = Result<T, ApiError>;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error(transparent)]
    Database(#[from] Failure),
    #[error(transparent)]
    Unexpected(#[from] anyhow::Error),
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        use ApiError::*;

        let (status, message) = match &self {
            BadRequest(message) => (StatusCode::BAD_REQUEST, message.clone()),
            NotFound(message) => (StatusCode::NOT_FOUND, message.clone()),
            Database(error) => match error.code.as_str() {
                "not_found" => (StatusCode::NOT_FOUND, "resource not found".to_string()),
                "usage_policy_conflict" => {
                    (StatusCode::CONFLICT, "constraint conflict".to_string())
                }
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "database error".to_string(),
                ),
            },
            Unexpected(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "unexpected error".to_string(),
            ),
        };

        let payload = Json(ErrorResponse { error: message });
        (status, payload).into_response()
    }
}
