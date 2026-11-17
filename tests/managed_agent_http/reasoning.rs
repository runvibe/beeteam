use super::*;

#[tokio::test]
async fn reasoning_summaries_are_kept_on_the_agent_message() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"think"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    assert_eq!(sent.0, 202, "{sent:?}");
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    let requester = &snapshot["messages"]["items"][0];
    let agent_message = &snapshot["messages"]["items"][1];
    assert_eq!(agent_message["content"], "Response");
    assert_eq!(
        agent_message["reasoning"],
        "**Plan** steps\n\nRaw-free summary"
    );
    assert!(requester["reasoning"].is_null(), "{requester}");
}

#[tokio::test]
async fn messages_without_reasoning_expose_null() {
    let (app, agent, _, _) = configured().await;
    let sent = request_key(
        &app,
        "POST",
        &format!("/api/v2/agents/{}/requests", id(&agent)),
        json!({"content":"hello"}),
        None,
        Uuid::new_v4(),
    )
    .await;
    let snapshot = wait_state(&app, &sent.1, "completed").await;
    assert!(snapshot["messages"]["items"][1]["reasoning"].is_null());
}
