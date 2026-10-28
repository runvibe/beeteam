use crate::{dto::changes::Change, state::AppState};
use axum::{
    extract::State,
    response::sse::{Event, Sse},
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
                match tokio::time::timeout(Duration::from_secs(15), receiver.recv()).await {
                    Ok(Ok(value)) => value,
                    Ok(Err(tokio::sync::broadcast::error::RecvError::Lagged(_))) => Change::Reset,
                    Ok(Err(tokio::sync::broadcast::error::RecvError::Closed)) => return None,
                    Err(_) => Change::Heartbeat,
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
    ([("X-Accel-Buffering", "no")], Sse::new(stream))
}
