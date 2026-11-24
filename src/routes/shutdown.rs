//! Ends long-lived event streams once process shutdown starts, so graceful
//! shutdown only waits for ordinary in-flight requests.
use axum::{body::Body, extract::Request, middleware::Next, response::Response};
use futures_util::StreamExt;
use tokio::sync::watch;

pub async fn end_event_streams_on_shutdown(
    stopping: watch::Receiver<bool>,
    request: Request,
    next: Next,
) -> Response {
    let response = next.run(request).await;
    let is_event_stream = response
        .headers()
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("text/event-stream"));
    if !is_event_stream {
        return response;
    }
    let (parts, body) = response.into_parts();
    let mut stopping = stopping;
    let stream = body.into_data_stream().take_until(async move {
        let _ = stopping.wait_for(|stop| *stop).await;
    });
    Response::from_parts(parts, Body::from_stream(stream))
}
