use crate::{
    dto::{
        backend::{parse_id, Failure},
        local_projects::OpenProjectRequest,
    },
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, ConnectInfo, DefaultBodyLimit, Path, Request, State},
    http::{uri::Authority, HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use std::net::{IpAddr, SocketAddr};

pub fn router(loopback_listener: bool) -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/tasks/{taskId}/projects/{projectKey}/open",
            post(open),
        )
        .layer(DefaultBodyLimit::max(1024))
        .layer(middleware::from_fn_with_state(
            loopback_listener,
            local_only,
        ))
}
fn local_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host
            .trim_matches(['[', ']'])
            .parse::<IpAddr>()
            .is_ok_and(|ip| ip.is_loopback())
}
fn allowed(bound_local: bool, peer: Option<SocketAddr>, headers: &HeaderMap) -> bool {
    if !bound_local
        || !peer.is_some_and(|p| p.ip().is_loopback())
        || headers
            .get("x-bee-local-action")
            .and_then(|h| h.to_str().ok())
            != Some("open-project")
        || headers
            .keys()
            .any(|k| k == "forwarded" || k.as_str().starts_with("x-forwarded-") || k == "x-real-ip")
    {
        return false;
    }
    let host_ok = headers
        .get("host")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.parse::<Authority>().ok())
        .is_some_and(|a| local_host(a.host()));
    let origin_ok = headers.get("origin").is_none_or(|origin| {
        origin
            .to_str()
            .ok()
            .and_then(|o| url::Url::parse(o).ok())
            .is_some_and(|o| {
                matches!(o.scheme(), "http" | "https")
                    && o.host_str().is_some_and(local_host)
                    && o.username().is_empty()
                    && o.password().is_none()
                    && o.query().is_none()
                    && o.fragment().is_none()
                    && o.path() == "/"
            })
    });
    host_ok && origin_ok
}
async fn local_only(State(bound_local): State<bool>, request: Request, next: Next) -> Response {
    let peer = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|p| p.0);
    if !allowed(bound_local, peer, request.headers()) {
        return (
            StatusCode::FORBIDDEN,
            Json(Failure::new(
                "local_action_forbidden",
                "A abertura de projetos exige acesso local direto ao Bee Team.",
            )),
        )
            .into_response();
    }
    next.run(request).await
}
async fn open(
    State(state): State<AppState>,
    Path((task, project)): Path<(String, String)>,
    input: std::result::Result<Json<OpenProjectRequest>, JsonRejection>,
) -> Response {
    let input = match input {
        Ok(Json(input)) => input,
        Err(error) => {
            return (error.status(), Json(Failure::invalid(error.body_text()))).into_response()
        }
    };
    let result = match parse_id(&task) {
        Ok(task) => state.local_projects().open(task, project, input).await,
        Err(error) => Err(error),
    };
    match result {
        Ok(response) => (StatusCode::ACCEPTED, Json(response)).into_response(),
        Err(error) => {
            let status = match error.code.as_str() {
                "not_found" | "project_not_found" | "project_folder_unavailable" => {
                    StatusCode::NOT_FOUND
                }
                "local_application_unavailable" | "local_inspection_timeout" => {
                    StatusCode::SERVICE_UNAVAILABLE
                }
                "local_application_unsupported" => StatusCode::NOT_IMPLEMENTED,
                "local_launch_failed" => StatusCode::INTERNAL_SERVER_ERROR,
                "local_path_invalid" => StatusCode::BAD_REQUEST,
                _ => return super::backend::failure(error),
            };
            (status, Json(error)).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_public_bind_missing_peer_rebinding_and_forwarded_requests() {
        let mut h = HeaderMap::new();
        h.insert("host", "127.0.0.1:59865".parse().unwrap());
        h.insert("x-bee-local-action", "open-project".parse().unwrap());
        h.insert("origin", "http://localhost:5176".parse().unwrap());
        let peer = Some("127.0.0.1:40000".parse().unwrap());
        assert!(allowed(true, peer, &h));
        assert!(!allowed(false, peer, &h));
        assert!(!allowed(true, None, &h));
        h.insert("host", "attacker.example:59865".parse().unwrap());
        assert!(!allowed(true, peer, &h));
        h.insert("host", "[::1]:59865".parse().unwrap());
        assert!(allowed(true, peer, &h));
        h.insert("x-forwarded-for", "127.0.0.1".parse().unwrap());
        assert!(!allowed(true, peer, &h));
    }
}
