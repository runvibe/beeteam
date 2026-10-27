mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn upload(app: &Router, path: &str, bytes: &[u8], version: i64) -> (u16, Value) {
    let mut body=b"--bee\r\nContent-Disposition: form-data; name=\"file\"; filename=\"image.png\"\r\nContent-Type: image/png\r\n\r\n".to_vec();
    body.extend_from_slice(bytes);
    body.extend_from_slice(b"\r\n--bee--\r\n");
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(path)
                .header("content-type", "multipart/form-data; boundary=bee")
                .header("X-Actor-Kind", "human")
                .header("If-Match", format!("\"{version}\""))
                .header("Idempotency-Key", uuid::Uuid::new_v4().to_string())
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status().as_u16();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
async fn download(app: &Router, path: &str) -> (u16, Vec<u8>) {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status().as_u16();
    if status == 200 {
        if path.contains("/image/content") {
            assert_eq!(response.headers()["Content-Type"], "image/png");
        }
        assert_eq!(response.headers()["X-Content-Type-Options"], "nosniff");
        assert!(response.headers()["Content-Disposition"]
            .to_str()
            .unwrap()
            .starts_with("attachment"));
    }
    (
        status,
        response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes()
            .to_vec(),
    )
}
#[tokio::test]
async fn images_copy_independently_and_attachments_keep_tombstones() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Image source","contextSummary":"Do not copy automatically"}),
        None,
    )
    .await;
    let leader = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Leader"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Target","leaderId":id(&leader),"coordinationContext":manual()}),
        None,
    )
    .await;
    let mut png = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(1, 1)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    let png = png.into_inner();
    let path = format!("/api/v1/agents/{}/image", id(&agent));
    assert_eq!(
        upload(&app, &path, b"not image", ver(&agent).unwrap())
            .await
            .0,
        415
    );
    let (status, agent) = upload(&app, &path, &png, ver(&agent).unwrap()).await;
    assert_eq!(status, 201, "{agent}");
    let result=ok(&app,"POST",&format!("/api/v1/agents/{}/copies",id(&agent)),json!({"targetTeamId":id(&team),"expectedTeamVersion":team["version"],"coordinationContext":manual()}),ver(&agent)).await;
    let copy = &result["agent"];
    assert_ne!(copy["image"]["imageId"], agent["image"]["imageId"]);
    assert_eq!(copy["contextSummary"], "");
    assert_ne!(copy["slug"], agent["slug"]);
    assert_eq!(copy["slug"], "image-source-2");
    assert_eq!(
        request(&app, "DELETE", &path, json!({}), ver(&agent))
            .await
            .0,
        204
    );
    assert_eq!(download(&app, &format!("{path}/content")).await.0, 404);
    assert_eq!(
        download(&app, &format!("/api/v1/agents/{}/image/content", id(copy)))
            .await
            .1,
        png
    );
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Files","teamId":id(&team)}),
        None,
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Files","authorAgentId":id(&leader),"executorAgentId":id(copy),"coordinationContext":manual()}),None).await;
    let (status, file) = upload(
        &app,
        &format!("/api/v1/tasks/{}/attachments", id(&task)),
        b"evidence",
        ver(&task).unwrap(),
    )
    .await;
    assert_eq!(status, 201, "{file}");
    let path = format!("/api/v1/tasks/{}/attachments/{}", id(&task), id(&file));
    assert_eq!(
        download(&app, &format!("{path}/content")).await.1,
        b"evidence"
    );
    let task = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    assert_eq!(
        request(&app, "DELETE", &path, json!({}), ver(&task))
            .await
            .0,
        204
    );
    assert_eq!(download(&app, &format!("{path}/content")).await.0, 404);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/attachments", id(&task))).await["total"],
        0
    );
    let tombstones = get(
        &app,
        &format!(
            "/api/v1/tasks/{}/attachments?includeRemoved=true",
            id(&task)
        ),
    )
    .await;
    assert_eq!(tombstones["total"], 1);
    assert!(tombstones["items"][0]["deletedAt"].is_string());
}

#[tokio::test]
async fn statuses_versions_archives_and_replays() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Leader"}),
        None,
    )
    .await;
    let agent = ok(
        &app,
        "PATCH",
        &format!("/api/v1/agents/{}", id(&agent)),
        json!({"roleDescription":"Lead"}),
        ver(&agent),
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    ok(
        &app,
        "PATCH",
        &format!("/api/v1/teams/{}", id(&team)),
        json!({"purpose":"Changed"}),
        ver(&team),
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Statuses","teamId":id(&team)}),
        None,
    )
    .await;
    let status = ok(
        &app,
        "POST",
        &format!("/api/v1/boards/{}/statuses", id(&board)),
        json!({"name":"Extra"}),
        None,
    )
    .await;
    let _updated_status = ok(
        &app,
        "PATCH",
        &format!("/api/v1/boards/{}/statuses/{}", id(&board), id(&status)),
        json!({"name":"Extra revised"}),
        ver(&status),
    )
    .await;
    let statuses = get(&app, &format!("/api/v1/boards/{}/statuses", id(&board))).await;
    let board = get(&app, &format!("/api/v1/boards/{}", id(&board))).await;
    let ids: Vec<_> = statuses["items"]
        .as_array()
        .unwrap()
        .iter()
        .rev()
        .map(|s| s["id"].clone())
        .collect();
    ok(
        &app,
        "PUT",
        &format!("/api/v1/boards/{}/status-order", id(&board)),
        json!({"statusIds":ids}),
        ver(&board),
    )
    .await;
    let status = get(
        &app,
        &format!("/api/v1/boards/{}/statuses?name=Extra", id(&board)),
    )
    .await["items"][0]
        .clone();
    ok(
        &app,
        "PATCH",
        &format!("/api/v1/boards/{}/statuses/{}", id(&board), id(&status)),
        json!({"archived":true}),
        ver(&status),
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Archive","authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    let p = format!("/api/v1/tasks/{}", id(&task));
    assert_eq!(
        request(&app, "PATCH", &p, json!({"title":"Missing version"}), None)
            .await
            .0,
        428
    );
    assert_eq!(
        request(
            &app,
            "PATCH",
            &p,
            json!({"title":"Stale version"}),
            Some(99)
        )
        .await
        .0,
        412
    );
    let task = ok(
        &app,
        "PUT",
        &format!("{p}/archive"),
        json!({"archived":true}),
        ver(&task),
    )
    .await;
    assert_eq!(
        request(&app, "PATCH", &p, json!({"title":"Archived"}), ver(&task))
            .await
            .0,
        409
    );
    ok(
        &app,
        "PUT",
        &format!("{p}/archive"),
        json!({"archived":false}),
        ver(&task),
    )
    .await;
    let free = ok(&app, "POST", "/api/v1/agents", json!({"name":"Free"}), None).await;
    let archived = ok(
        &app,
        "PUT",
        &format!("/api/v1/agents/{}/archive", id(&free)),
        json!({"archived":true}),
        ver(&free),
    )
    .await;
    ok(
        &app,
        "PUT",
        &format!("/api/v1/agents/{}/archive", id(&free)),
        json!({"archived":false}),
        ver(&archived),
    )
    .await;
    let key = uuid::Uuid::new_v4();
    let call = |name: &str| {
        Request::builder()
            .method("POST")
            .uri("/api/v1/agents")
            .header("content-type", "application/json")
            .header("X-Actor-Kind", "human")
            .header("Idempotency-Key", key.to_string())
            .body(Body::from(json!({"name":name}).to_string()))
            .unwrap()
    };
    let first = app
        .clone()
        .oneshot(call("Idempotent"))
        .await
        .unwrap()
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let second = app
        .clone()
        .oneshot(call("Idempotent"))
        .await
        .unwrap()
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    assert_eq!(first, second);
    assert_eq!(
        app.clone().oneshot(call("Changed")).await.unwrap().status(),
        409
    );
}
