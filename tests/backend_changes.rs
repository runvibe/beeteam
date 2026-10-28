mod support;
use axum::{body::Body, http::Request};
use http_body_util::BodyExt;
use serde_json::json;
use sqlx::postgres::PgListener;
use std::time::Duration;
use support::*;
use tower::ServiceExt;

#[tokio::test]
async fn notifications_follow_commit_not_rollback_replay_or_reads() {
    let (app, pool) = app_with_pool().await;
    let mut listener = PgListener::connect_with(&pool).await.unwrap();
    listener
        .listen(beeteam::repositories::changes::CHANNEL)
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    beeteam::repositories::changes::notify(&mut tx)
        .await
        .unwrap();
    assert!(
        tokio::time::timeout(Duration::from_millis(100), listener.recv())
            .await
            .is_err()
    );
    tx.rollback().await.unwrap();
    assert!(
        tokio::time::timeout(Duration::from_millis(100), listener.recv())
            .await
            .is_err()
    );
    let key = uuid::Uuid::new_v4();
    let body = json!({"name":"Committed change"});
    let (status, first) =
        request_key(&app, "POST", "/api/v1/agents", body.clone(), None, key).await;
    assert_eq!(status, 201);
    let notice = tokio::time::timeout(Duration::from_secs(2), listener.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(notice.payload(), "");
    let stored: i64 = sqlx::query_scalar("SELECT count(*) FROM agents WHERE id=$1")
        .bind(uuid::Uuid::parse_str(first["id"].as_str().unwrap()).unwrap())
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(stored, 1);
    let (_, replay) = request_key(&app, "POST", "/api/v1/agents", body, None, key).await;
    assert_eq!(first, replay);
    request(&app, "GET", "/api/v1/agents", json!(null), None).await;
    let (status, _) = request(&app, "POST", "/api/v1/agents", json!({}), None).await;
    assert_eq!(status, 400);
    assert!(
        tokio::time::timeout(Duration::from_millis(150), listener.recv())
            .await
            .is_err()
    );
}

#[tokio::test]
async fn sse_starts_with_reset_reconnects_and_delivers_committed_change() {
    let (app, pool) = app_with_pool().await;
    for attempt in 0..2 {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/changes")
                    .header("last-event-id", "old-lost-event")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        assert!(response.headers()["content-type"]
            .to_str()
            .unwrap()
            .starts_with("text/event-stream"));
        let mut body = response.into_body();
        let frame = tokio::time::timeout(Duration::from_secs(2), body.frame())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        let text = String::from_utf8(frame.into_data().unwrap().to_vec()).unwrap();
        assert!(text.contains("event: reset"));
        assert!(text.contains("retry: 3000"));
        assert!(text.contains(r#"{"scope":"all"}"#));
        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let ready: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'LISTEN%')").fetch_one(&pool).await.unwrap();
                if ready { break; }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        }).await.unwrap();
        request(
            &app,
            "POST",
            "/api/v1/agents",
            json!({"name":"SSE committed"}),
            None,
        )
        .await;
        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let frame = body.frame().await.unwrap().unwrap();
                if String::from_utf8_lossy(frame.data_ref().unwrap()).contains("event: invalidate")
                {
                    break;
                }
            }
        })
        .await
        .unwrap();
        if attempt == 0 {
            // Terminate only the LISTEN connection in this test's newly-created isolated DB.
            let listener_pid: i32 = sqlx::query_scalar("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'LISTEN%' AND pid <> pg_backend_pid() LIMIT 1")
                .fetch_one(&pool).await.unwrap();
            sqlx::query("SELECT pg_terminate_backend($1)")
                .bind(listener_pid)
                .execute(&pool)
                .await
                .unwrap();
            let frame = tokio::time::timeout(Duration::from_secs(5), body.frame())
                .await
                .unwrap()
                .unwrap()
                .unwrap();
            assert!(String::from_utf8_lossy(frame.data_ref().unwrap()).contains("event: reset"));
        }
        // Dropping the response cancels this subscriber without stopping other subscriptions.
    }
}

#[tokio::test]
async fn quiet_stream_sends_observable_heartbeat_without_invalidation() {
    let (app, _) = app_with_pool().await;
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/changes")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let mut body = response.into_body();
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            let frame = body.frame().await.unwrap().unwrap();
            let text = String::from_utf8_lossy(frame.data_ref().unwrap());
            assert!(!text.contains("event: invalidate"));
            if text.contains("event: heartbeat") {
                break;
            }
        }
    })
    .await
    .unwrap();
}
