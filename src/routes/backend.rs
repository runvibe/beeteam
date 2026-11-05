use crate::{
    dto::{
        backend::*,
        contracts::{self, OPERATIONS},
    },
    state::AppState,
};
use axum::{
    body::{to_bytes, Body},
    extract::{FromRequest, MatchedPath, Multipart, Path, Request, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{on, MethodFilter},
    Extension, Json, Router,
};
use serde_json::json;
use std::collections::BTreeMap;

pub fn router(json_limit: usize) -> Router<AppState> {
    let mut router = Router::new();
    for op in OPERATIONS.iter() {
        let method = match op.method.as_str() {
            "GET" => MethodFilter::GET,
            "POST" => MethodFilter::POST,
            "PUT" => MethodFilter::PUT,
            "PATCH" => MethodFilter::PATCH,
            "DELETE" => MethodFilter::DELETE,
            _ => continue,
        };
        router = router.route(&op.path, on(method, dispatch));
        router = router.route(&op.path.replacen("/api/v2", "/api/v1", 1), on(method, dispatch));
    }
    router
        .layer(axum::extract::DefaultBodyLimit::max(22 * 1024 * 1024))
        .layer(Extension(json_limit))
}
pub fn failure(error: Failure) -> Response {
    let status = match error.code.as_str() {
        "not_found" => 404,
        "invalid_request" | "invalid_actor_context" => 400,
        "version_required" => 428,
        "version_conflict" => 412,
        "payload_too_large" => 413,
        "unsupported_media_type" => 415,
        "storage_unavailable" => 503,
        "internal_error" => 500,
        _ => 409,
    };
    (StatusCode::from_u16(status).unwrap(), Json(error)).into_response()
}
pub fn actor(headers: &HeaderMap) -> Result<Option<Actor>> {
    let kind = headers
        .get("X-Actor-Kind")
        .map(|v| v.to_str().map(str::to_owned))
        .transpose()
        .map_err(|_| Failure::new("invalid_actor_context", "Invalid actor header"))?;
    let id = headers
        .get("X-Actor-Id")
        .map(|v| {
            v.to_str()
                .map_err(|_| Failure::new("invalid_actor_context", "Invalid actor ID"))
                .and_then(parse_id)
        })
        .transpose()?;
    match kind {
        Some(kind) => {
            let actor = Actor { kind, id };
            actor.validate()?;
            Ok(Some(actor))
        }
        None if id.is_some() => Err(Failure::new("invalid_actor_context", "Actor kind required")),
        None => Ok(None),
    }
}
pub fn version(headers: &HeaderMap) -> Result<Option<i64>> {
    headers
        .get("If-Match")
        .map(|v| {
            let s = v
                .to_str()
                .map_err(|_| Failure::invalid("Invalid If-Match"))?;
            if !s.starts_with('"') || !s.ends_with('"') {
                return Err(Failure::invalid(
                    "If-Match must contain one quoted integer ETag",
                ));
            }
            s.trim_matches('"')
                .parse::<i64>()
                .map_err(|_| Failure::invalid("Invalid If-Match"))
        })
        .transpose()
}
async fn dispatch(
    State(state): State<AppState>,
    path: MatchedPath,
    Path(params): Path<BTreeMap<String, String>>,
    Extension(json_limit): Extension<usize>,
    request: Request,
) -> Response {
    match handle(state, path.as_str().to_owned(), params, request, json_limit).await {
        Ok(response) => response,
        Err(error) => failure(error),
    }
}
async fn handle(
    state: AppState,
    path: String,
    params: BTreeMap<String, String>,
    request: Request,
    json_limit: usize,
) -> Result<Response> {
    let legacy = path.starts_with("/api/v1/");
    let canonical_path = path.replacen("/api/v1", "/api/v2", 1);
    let op = OPERATIONS
        .iter()
        .find(|o| o.path == canonical_path && o.method == request.method().as_str())
        .ok_or_else(Failure::missing)?;
    let headers = request.headers();
    for name in ["X-Actor-Kind", "X-Actor-Id", "If-Match", "Idempotency-Key"] {
        if headers.get_all(name).iter().count() > 1 {
            return Err(Failure::invalid("Repeated request header"));
        }
    }
    let actor = actor(headers)?;
    let expected_version = version(headers)?;
    let idempotency_key = headers
        .get("Idempotency-Key")
        .map(|v| {
            v.to_str()
                .ok()
                .and_then(|s| uuid::Uuid::parse_str(s).ok())
                .ok_or_else(|| Failure::invalid("Invalid Idempotency-Key"))
        })
        .transpose()?;
    let query = contracts::query(
        op,
        url::form_urlencoded::parse(request.uri().query().unwrap_or("").as_bytes())
            .into_owned()
            .collect(),
    )?;
    let multipart = matches!(op.name.as_str(), "createAttachment" | "uploadAgentImage");
    let mut upload = None;
    let body = if multipart {
        let (parts, body) = request.into_parts();
        let limit = if op.name == "uploadAgentImage" {
            6 * 1024 * 1024
        } else {
            21 * 1024 * 1024
        };
        let bytes = to_bytes(body, limit).await.map_err(|_| {
            Failure::new("payload_too_large", "Multipart body exceeds contract limit")
        })?;
        let request = Request::from_parts(parts, Body::from(bytes));
        let mut multipart = Multipart::from_request(request, &state)
            .await
            .map_err(|_| Failure::invalid("Invalid multipart body"))?;
        let mut data = json!({});
        let mut fields = std::collections::BTreeSet::new();
        while let Some(field) = multipart.next_field().await.map_err(|_| {
            Failure::new("payload_too_large", "Invalid or oversized multipart field")
        })? {
            let name = field.name().unwrap_or("").to_owned();
            if !fields.insert(name.clone()) {
                return Err(Failure::invalid("Duplicate multipart field"));
            }
            if name == "file" {
                let filename = field.file_name().unwrap_or("file").to_owned();
                let media_type = field
                    .content_type()
                    .unwrap_or("application/octet-stream")
                    .to_owned();
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|_| Failure::new("payload_too_large", "File exceeds body limit"))?
                    .to_vec();
                upload = Some(Upload {
                    name: filename,
                    media_type,
                    bytes,
                });
            } else if name == "description" && op.name == "createAttachment" {
                let text = field
                    .text()
                    .await
                    .map_err(|_| Failure::invalid("Invalid description"))?;
                if text.len() > 65536 {
                    return Err(Failure::invalid("Description too long"));
                }
                data["description"] = json!(text);
            } else {
                return Err(Failure::invalid("Unexpected multipart field"));
            }
        }
        data
    } else {
        let bytes = to_bytes(request.into_body(), json_limit)
            .await
            .map_err(|_| Failure::new("payload_too_large", "JSON body exceeds limit"))?;
        if bytes.is_empty() {
            json!({})
        } else {
            serde_json::from_slice(&bytes).map_err(|_| Failure::invalid("Invalid JSON"))?
        }
    };
    let command = Command {
        operation: op.name.clone(),
        params: params.clone(),
        query,
        body,
        actor,
        expected_version,
        idempotency_key,
        upload,
    };
    let mut result = state.backend().execute(command).await?;
    if legacy { crate::dto::worker_contract::response(op, &mut result.data, true)?; }
    let mut response = if let Some(file) = result.file {
        let mut response = Response::new(Body::from(file.bytes));
        let name: String = file
            .name
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | ' '))
            .collect();
        response.headers_mut().insert(
            "Content-Type",
            if op.name == "downloadAgentImage" {
                file.media_type
                    .parse()
                    .map_err(|_| Failure::new("internal_error", "Invalid stored image type"))?
            } else {
                "application/octet-stream".parse().unwrap()
            },
        );
        response.headers_mut().insert(
            "Content-Disposition",
            format!(
                "attachment; filename=\"{}\"",
                if name.is_empty() { "download" } else { &name }
            )
            .parse()
            .unwrap(),
        );
        response
            .headers_mut()
            .insert("X-Content-Type-Options", "nosniff".parse().unwrap());
        response
    } else if op.status == 204 {
        StatusCode::NO_CONTENT.into_response()
    } else {
        (StatusCode::from_u16(op.status).unwrap(), Json(result.data)).into_response()
    };
    if let Some(version) = result.version {
        response
            .headers_mut()
            .insert("ETag", format!("\"{version}\"").parse().unwrap());
    }
    if op.status == 201 {
        if let Some(id) = result.created_id {
            let mut location = path.clone();
            for (key, value) in params {
                location = location.replace(&format!("{{{key}}}"), &value);
            }
            location = match op.name.as_str() {
                "createAgent" | "createTeam" | "createBoard" => format!("{location}/{id}"),
                "createTask" => format!("/api/{}/tasks/{id}", if legacy { "v1" } else { "v2" }),
                "uploadAgentImage" => location,
                _ => format!("{location}#{id}"),
            };
            response
                .headers_mut()
                .insert("Location", location.parse().unwrap());
        }
    }
    Ok(response)
}
