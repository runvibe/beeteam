//! HTTP adapter for the provider-neutral chat service.
use crate::{
    dto::backend::{Failure, Result},
    services::managed_agents::{command, ManagedAgentService},
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
    routing::{get, patch, post},
    Json, Router,
};
use futures_util::stream;
use serde_json::{json, Value};
use std::{collections::BTreeMap, convert::Infallible, time::Duration};
use uuid::Uuid;
pub fn router(config: &crate::config::AppConfig) -> Router<AppState> {
    Router::new()
        .route(
            "/api/v2/agents/{agentId}/execution-config",
            get(read).put(write),
        )
        .route("/api/v2/agents/{agentId}/requests", get(read).post(write))
        .route("/api/v2/agents/{agentId}/conversations", get(read))
        .route("/api/v2/teams/{teamId}/managed-approvals", get(read))
        .route("/api/v2/agent-requests/{requestId}", get(read))
        .route("/api/v2/agent-requests/{requestId}/events", get(events))
        .route("/api/v2/agent-requests/{requestId}/cancel", post(write))
        .route("/api/v2/agent-requests/{requestId}/reconcile", post(write))
        .route("/api/v2/agent-conversations", get(sessions))
        .route(
            "/api/v2/agent-conversations/{conversationId}",
            patch(write),
        )
        .route(
            "/api/v2/agent-conversations/{conversationId}/messages",
            get(read),
        )
        .route("/api/v2/agent-approvals/{approvalId}/decision", post(write))
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
        "version_conflict" => 412,
        "queue_full" => 429,
        "operation_removed" | "cursor_expired" => 410,
        "provider_unavailable" => 503,
        "payload_too_large" => 413,
        "storage_unavailable" => 503,
        "internal_error" => 500,
        _ => 409,
    };
    let mut response = (
        StatusCode::from_u16(status).unwrap(),
        Json(json!({"code":e.code,"message":e.error,"retryable":false})),
    )
        .into_response();
    if status == 429 {
        response
            .headers_mut()
            .insert("Retry-After", "1".parse().unwrap());
    }
    response
}
fn params(mut p: BTreeMap<String, String>) -> Result<BTreeMap<String, String>> {
    for v in p.values_mut() {
        *v = crate::dto::backend::parse_id(v)?.to_string();
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
        let op = if path.as_str().ends_with("/managed-approvals") {
            "team-approvals"
        } else if path.as_str().ends_with("/execution-config") {
            "config"
        } else if path.as_str().ends_with("/messages") {
            "messages"
        } else if path.as_str().ends_with("/conversations") {
            "conversations"
        } else if path.as_str().ends_with("/requests") {
            "requests"
        } else {
            "snapshot"
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
                if matches!(k.as_str(), "teamId") {
                    crate::dto::backend::parse_id(&v)?;
                }
                c.query.insert(k, json!(v));
            }
        }
        Ok(json_response(
            state.managed_agents().read(c).await?,
            StatusCode::OK,
        ))
    }
    .await;
    result.unwrap_or_else(error)
}
async fn sessions(
    State(state): State<AppState>,
    Query(q): Query<BTreeMap<String, String>>,
) -> Response {
    match state.managed_agents().sessions(&q).await {
        Ok(v) => json_response(v, StatusCode::OK),
        Err(e) => error(e),
    }
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
        let op = if path.as_str().ends_with("/execution-config") {
            "configure"
        } else if path.as_str().ends_with("/reconcile") {
            "reconcile"
        } else if path.as_str().ends_with("/cancel") {
            "cancel"
        } else if path.as_str().ends_with("/decision") {
            "decision"
        } else if path.as_str().ends_with("/{conversationId}") {
            "update-conversation"
        } else {
            "send"
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
        if let Some(actor) = &c.actor {
            actor.validate()?;
        }
        c.expected_version = super::backend::version(headers)?;
        c.idempotency_key = Some(
            headers
                .get("Idempotency-Key")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| Uuid::parse_str(v).ok())
                .ok_or_else(|| Failure::new("version_required", "Idempotency-Key required"))?,
        );
        let bytes = to_bytes(request.into_body(), 1024 * 1024)
            .await
            .map_err(|_| Failure::new("payload_too_large", "Request exceeds limit"))?;
        c.body = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).map_err(|_| Failure::invalid("Invalid JSON body"))?
        };
        if matches!(op, "cancel" | "reconcile") && !c.body.is_null() {
            return Err(Failure::invalid("No body accepted"));
        }
        let out = if op == "reconcile" {
            state.managed_agents().reconcile(c).await?
        } else {
            state.managed_agents().write(c, "http").await?
        };
        Ok(json_response(
            out,
            if op == "send" {
                StatusCode::ACCEPTED
            } else {
                StatusCode::OK
            },
        ))
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
async fn event_batch(service: &ManagedAgentService, chat: &str, after: &str) -> Result<Vec<Value>> {
    let mut c = command("events");
    c.params.insert("requestId".into(), chat.into());
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
        let chat = p["requestId"].clone();
        let initial = format!("{chat}:{chat}");
        let raw = headers
            .get("Last-Event-ID")
            .and_then(|v| v.to_str().ok())
            .or_else(|| q.get("after").map(String::as_str))
            .unwrap_or(&initial);
        cursor(&chat, raw)?;
        let after = raw.to_owned();
        let service = state.managed_agents().clone();
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
                        let event_id = v["cursor"].as_str()?.to_owned();
                        cursor(&chat, &event_id).ok()?;
                        after = event_id.clone();
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
