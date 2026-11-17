//! HTTP adapter for the provider-neutral chat service.
use crate::{
    dto::backend::{Failure, Result},
    services::leader_chat::{command, LeaderChatService},
    state::AppState,
};
use axum::{
    body::to_bytes,
    extract::{MatchedPath, Path, Query, Request, State},
    http::{HeaderMap, StatusCode},
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post},
    Json, Router,
};
use futures_util::stream;
use serde_json::{json, Value};
use std::{collections::BTreeMap, convert::Infallible, time::Duration};
use uuid::Uuid;
pub fn router(config: &crate::config::AppConfig) -> Router<AppState> {
    Router::new()
        .route("/api/v2/leader-chats", get(read).post(write))
        .route("/api/v2/leader-chats/{chatId}", get(read))
        .route(
            "/api/v2/leader-chats/{chatId}/messages",
            get(read).post(write),
        )
        .route("/api/v2/leader-chats/{chatId}/events", get(events))
        .route("/api/v2/leader-chats/{chatId}/turns/{turnId}", get(read))
        .route(
            "/api/v2/leader-chats/{chatId}/turns/{turnId}/reconcile",
            post(write),
        )
        .route(
            "/api/v2/leader-chats/{chatId}/turns/{turnId}/cancel",
            post(write),
        )
        .route(
            "/api/v2/leader-chats/{chatId}/approvals/{approvalId}/decision",
            post(write),
        )
        .route("/api/v2/agents/{agentId}/runtime", get(read))
        .route("/api/v2/agents/{agentId}/integrated-session", post(write))
        .layer(axum::middleware::from_fn_with_state(
            super::local_access::Policy::new(config, false),
            super::local_access::enforce,
        ))
}
fn error(e: Failure) -> Response {
    let status = match e.code.as_str() {
        "invalid_request" | "invalid_actor_context" => 400,
        "not_found" => 404,
        "version_required" => 428,
        "payload_too_large" => 413,
        "storage_unavailable" => 503,
        "operation_removed" => 410,
        "internal_error" => 500,
        _ => 409,
    };
    (StatusCode::from_u16(status).unwrap(), Json(e)).into_response()
}
fn params(p: BTreeMap<String, String>) -> Result<BTreeMap<String, String>> {
    for v in p.values() {
        crate::dto::backend::parse_id(v)?;
    }
    Ok(p)
}
async fn read(
    State(state): State<AppState>,
    path: MatchedPath,
    Path(p): Path<BTreeMap<String, String>>,
    Query(q): Query<BTreeMap<String, String>>,
) -> Response {
    let result = async {
        let op = if path.as_str().ends_with("/runtime") {
            "runtime"
        } else if path.as_str().ends_with("/messages") {
            "messages"
        } else if path.as_str().contains("/turns/") {
            "turn"
        } else if path.as_str().ends_with("{chatId}") {
            "snapshot"
        } else {
            "list"
        };
        let mut c = command(op);
        c.params = params(p)?;
        for (k, v) in q {
            if k == "limit" {
                let n = v
                    .parse::<u64>()
                    .map_err(|_| Failure::invalid("Invalid limit"))?;
                if !(1..=100).contains(&n) {
                    return Err(Failure::invalid("limit must be 1..100"));
                }
                c.query.insert(k, json!(n));
            } else {
                if matches!(k.as_str(), "teamId" | "cursor") {
                    crate::dto::backend::parse_id(&v)?;
                }
                c.query.insert(k, json!(v));
            }
        }
        Ok(json_response(
            state.leader_chat().read(c).await?,
            StatusCode::OK,
        ))
    }
    .await;
    result.unwrap_or_else(error)
}
fn json_response(v: Value, status: StatusCode) -> Response {
    let version = v["version"].as_i64();
    let mut r = (status, Json(v)).into_response();
    if let Some(v) = version {
        r.headers_mut()
            .insert("ETag", format!("\"{v}\"").parse().unwrap());
    }
    r
}
async fn write(
    State(state): State<AppState>,
    path: MatchedPath,
    Path(p): Path<BTreeMap<String, String>>,
    request: Request,
) -> Response {
    let result = async {
        let op = if path.as_str().ends_with("/integrated-session") {
            "create-session"
        } else if path.as_str().ends_with("/messages") {
            "send"
        } else if path.as_str().ends_with("/reconcile") {
            "reconcile"
        } else if path.as_str().ends_with("/cancel") {
            "cancel"
        } else if path.as_str().ends_with("/decision") {
            "decision"
        } else {
            "create"
        };
        let mut c = command(op);
        c.params = params(p)?;
        let headers = request.headers();
        for name in ["X-Actor-Kind", "X-Actor-Id", "If-Match", "Idempotency-Key"] {
            if headers.get_all(name).iter().count() > 1 {
                return Err(Failure::invalid("Duplicate command header"));
            }
        }
        c.actor = super::backend::actor(headers)?;
        c.actor()?.validate()?;
        c.expected_version = super::backend::version(headers)?;
        c.idempotency_key = Some(
            headers
                .get("Idempotency-Key")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| Uuid::parse_str(v).ok())
                .ok_or_else(|| Failure::invalid("Idempotency-Key required"))?,
        );
        let bytes = to_bytes(request.into_body(), 1024 * 1024)
            .await
            .map_err(|_| Failure::new("payload_too_large", "Request exceeds limit"))?;
        c.body = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).map_err(|_| Failure::invalid("Invalid JSON body"))?
        };
        if op == "create-session" {
            return Ok(json_response(
                state.leader_chat().create_session(c).await?,
                StatusCode::CREATED,
            ));
        }
        let out = if op == "reconcile" {
            state.leader_chat().reconcile(c).await?
        } else {
            state.leader_chat().write(c).await?
        };
        let status = match op {
            "send" => StatusCode::ACCEPTED,
            "cancel" => {
                if out.data["status"] == "cancel_requested" {
                    StatusCode::ACCEPTED
                } else {
                    StatusCode::OK
                }
            }
            "create" if out.created_id.is_some() => StatusCode::CREATED,
            _ => StatusCode::OK,
        };
        Ok(json_response(out.data, status))
    }
    .await;
    result.unwrap_or_else(error)
}
fn cursor(chat: &str, value: &str) -> Result<String> {
    let (owner, id) = value
        .split_once(':')
        .ok_or_else(|| Failure::invalid("Invalid event cursor"))?;
    if owner != chat {
        return Err(Failure::invalid("Cursor belongs to another chat"));
    }
    Ok(Uuid::parse_str(id)
        .map_err(|_| Failure::invalid("Invalid event cursor"))?
        .to_string())
}
async fn event_batch(service: &LeaderChatService, chat: &str, after: &str) -> Result<Vec<Value>> {
    let mut c = command("events");
    c.params.insert("chatId".into(), chat.into());
    c.query.insert("after".into(), json!(after));
    Ok(service
        .read(c)
        .await?
        .as_array()
        .cloned()
        .unwrap_or_default())
}
async fn events(
    State(state): State<AppState>,
    Path(p): Path<BTreeMap<String, String>>,
    Query(q): Query<BTreeMap<String, String>>,
    headers: HeaderMap,
) -> Response {
    let result = async {
        let p = params(p)?;
        let chat = p["chatId"].clone();
        let raw = headers
            .get("Last-Event-ID")
            .and_then(|v| v.to_str().ok())
            .or_else(|| q.get("after").map(String::as_str))
            .ok_or_else(|| Failure::invalid("Event cursor required"))?;
        let after = cursor(&chat, raw)?;
        let service = state.leader_chat().clone();
        let batch = event_batch(&service, &chat, &after).await?;
        let events = stream::unfold(
            (
                service,
                chat,
                after,
                std::collections::VecDeque::from(batch),
            ),
            |(service, chat, mut after, mut pending)| async move {
                loop {
                    if let Some(v) = pending.pop_front() {
                        let event_id = v["id"].as_str()?.to_owned();
                        after = cursor(&chat, &event_id).ok()?;
                        let e = Event::default()
                            .id(event_id)
                            .event(v["type"].as_str().unwrap_or("unknown"))
                            .json_data(v)
                            .ok()?;
                        return Some((Ok::<_, Infallible>(e), (service, chat, after, pending)));
                    }
                    tokio::time::sleep(Duration::from_millis(150)).await;
                    match event_batch(&service, &chat, &after).await {
                        Ok(v) => pending.extend(v),
                        Err(_) => return None,
                    }
                }
            },
        );
        Ok((
            [("X-Accel-Buffering", "no"), ("Cache-Control", "no-cache")],
            Sse::new(events).keep_alive(
                KeepAlive::new()
                    .interval(Duration::from_secs(15))
                    .text("heartbeat"),
            ),
        )
            .into_response())
    }
    .await;
    result.unwrap_or_else(error)
}
