use crate::{
    dto::data_transfer::RestoreRequest,
    services::data_transfer::service::{public_error, TransferService},
    state::AppState,
};
use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Multipart, Path, Request, State},
    http::{header, HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use tokio::io::AsyncReadExt;
use uuid::Uuid;
type Result<T> = std::result::Result<T, Error>;
pub struct Error(anyhow::Error);
impl From<anyhow::Error> for Error {
    fn from(e: anyhow::Error) -> Self {
        Self(e)
    }
}
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let code = public_error(&self.0);
        let status = match code.as_str() {
            "transfer_disabled" | "origin_forbidden" => StatusCode::FORBIDDEN,
            "job_not_found" => StatusCode::NOT_FOUND,
            "transfer_busy"
            | "destination_not_empty"
            | "idempotency_conflict"
            | "import_not_ready"
            | "export_not_ready" => StatusCode::CONFLICT,
            "upload_limit" | "expanded_limit" | "line_limit" => StatusCode::PAYLOAD_TOO_LARGE,
            "timestamp_precision_loss" | "confirmation_mismatch" | "preview_expired" => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            _ => StatusCode::BAD_REQUEST,
        };
        let active = self
            .0
            .downcast_ref::<crate::repositories::transfer::jobs::Busy>()
            .and_then(|b| b.active_job);
        (
            status,
            Json(json!({"code":code,"error":code,"details":{"activeJobId":active}})),
        )
            .into_response()
    }
}
fn service(state: &AppState) -> Result<&TransferService> {
    state
        .transfers()
        .map(|s| s.as_ref())
        .ok_or_else(|| Error(anyhow::anyhow!("transfer_disabled")))
}
fn key(headers: &HeaderMap) -> Result<Uuid> {
    headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| Error(anyhow::anyhow!("idempotency_key_required")))
}
pub async fn origin(State(state): State<AppState>, request: Request, next: Next) -> Response {
    if let Some(service) = state.transfers() {
        if request.headers().get(header::ORIGIN).is_some_and(|v| {
            v.to_str()
                .ok()
                .is_none_or(|o| !service.origin_allowed(Some(o)))
        }) {
            return Error(anyhow::anyhow!("origin_forbidden")).into_response();
        }
    }
    next.run(request).await
}
pub fn router(state: AppState) -> Router<AppState> {
    let limit = state
        .transfers()
        .map(|s| s.config.limits.compressed.saturating_add(1024 * 1024))
        .unwrap_or(1024 * 1024)
        .min(usize::MAX as u64) as usize;
    Router::new()
        .route("/api/v1/data-transfers", get(info))
        .route("/api/v1/data-transfers/exports", post(export))
        .route("/api/v1/data-transfers/jobs/{id}", get(status))
        .route("/api/v1/data-transfers/exports/{id}/file", get(download))
        .route("/api/v1/data-transfers/imports", post(upload))
        .route("/api/v1/data-transfers/imports/{id}/preview", get(preview))
        .route("/api/v1/data-transfers/imports/{id}/restore", post(restore))
        .route("/api/v1/data-transfers/jobs/{id}/cancel", post(cancel))
        .layer(DefaultBodyLimit::max(limit))
        .layer(tower_http::limit::RequestBodyLimitLayer::new(limit))
        .layer(middleware::from_fn_with_state(state, origin))
}
async fn info(State(state): State<AppState>) -> Json<Value> {
    Json(
        state
            .transfers()
            .map(|s| s.info())
            .unwrap_or(json!({"enabled":false})),
    )
}
async fn export(State(state): State<AppState>, headers: HeaderMap) -> Result<impl IntoResponse> {
    Ok((
        StatusCode::ACCEPTED,
        Json(service(&state)?.export(key(&headers)?).await?),
    ))
}
async fn status(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<impl IntoResponse> {
    Ok(Json(service(&state)?.status(id).await?))
}
async fn preview(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<impl IntoResponse> {
    let job = service(&state)?.status(id).await?;
    Ok(Json(job.preview.ok_or_else(|| {
        Error(anyhow::anyhow!("preview_missing"))
    })?))
}
async fn restore(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(body): Json<RestoreRequest>,
) -> Result<impl IntoResponse> {
    Ok((
        StatusCode::ACCEPTED,
        Json(service(&state)?.restore(id, key(&headers)?, body).await?),
    ))
}
async fn cancel(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<impl IntoResponse> {
    Ok(Json(service(&state)?.cancel(id, key(&headers)?).await?))
}
async fn download(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Response> {
    let file = service(&state)?.download(id).await?;
    let stream = futures_util::stream::try_unfold(file, |mut file| async move {
        let mut buffer = vec![0; 64 * 1024];
        let n = file.read(&mut buffer).await?;
        buffer.truncate(n);
        Ok::<_, std::io::Error>(if n == 0 { None } else { Some((buffer, file)) })
    });
    Ok((
        [
            (header::CONTENT_TYPE, "application/zip".to_owned()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{id}.beeteam.zip\""),
            ),
        ],
        Body::from_stream(stream),
    )
        .into_response())
}
async fn upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse> {
    let hash = headers
        .get("x-archive-sha256")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| Error(anyhow::anyhow!("archive_hash_required")))?;
    let mut upload = match service(&state)?.begin_import(key(&headers)?, hash).await? {
        Ok(upload) => upload,
        Err(job) => return Ok((StatusCode::ACCEPTED, Json(job))),
    };
    let mut found = false;
    while let Some(mut field) = wait_upload(&upload, multipart.next_field())
        .await?
        .map_err(|_| Error(anyhow::anyhow!("invalid_multipart")))?
    {
        if found || field.name() != Some("file") {
            return Err(Error(anyhow::anyhow!("invalid_multipart")));
        }
        found = true;
        while let Some(bytes) = wait_upload(&upload, field.chunk())
            .await?
            .map_err(|_| Error(anyhow::anyhow!("invalid_multipart")))?
        {
            upload.append(&bytes)?;
        }
    }
    if !found {
        return Err(Error(anyhow::anyhow!("missing_file")));
    }
    Ok((StatusCode::ACCEPTED, Json(upload.finish().await?)))
}

async fn wait_upload<F: std::future::Future>(
    upload: &crate::services::data_transfer::service::ImportUpload,
    future: F,
) -> Result<F::Output> {
    tokio::pin!(future);
    let mut interval = tokio::time::interval(std::time::Duration::from_millis(200));
    loop {
        tokio::select! {value=&mut future=>return Ok(value),_=interval.tick()=>upload.check()?}
    }
}
