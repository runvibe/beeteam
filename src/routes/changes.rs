use crate::{dto::changes::Change, state::AppState};
use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
    routing::get,
    Router,
};
use futures_util::stream;
use std::{convert::Infallible, time::Duration};
pub fn router() -> Router<AppState> {
    Router::new().route("/api/v1/changes", get(subscribe))
}
async fn subscribe(State(state): State<AppState>) -> impl axum::response::IntoResponse {
    let receiver = state.changes().subscribe();
    let stream = stream::unfold(
        (receiver, true, state),
        |(mut receiver, initial, state)| async move {
            let change = if initial {
                Change::Reset
            } else {
                match receiver.recv().await {
                    Ok(value) => value,
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => Change::Reset,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => return None,
                }
            };
            let event = Event::default()
                .event(change.event())
                .retry(Duration::from_secs(3))
                .json_data(change.payload())
                .expect("static invalidation payload");
            Some((Ok::<_, Infallible>(event), (receiver, false, state)))
        },
    );
    (
        [("X-Accel-Buffering", "no")],
        Sse::new(stream).keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(15))
                .text("keepalive"),
        ),
    )
}
