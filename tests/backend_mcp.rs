#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use support::*;
use tower::ServiceExt;

async fn rpc(app: &Router, method: &str, params: Value) -> Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/mcp")
                .header("host", "127.0.0.1")
                .header("content-type", "application/json")
                .header("accept", "application/json, text/event-stream")
                .header("mcp-protocol-version", "2025-11-25")
                .body(Body::from(
                    json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap()
}
async fn tool(app: &Router, name: &str, args: Value) -> Value {
    let response = rpc(app, "tools/call", json!({"name":name,"arguments":args})).await;
    assert!(response.get("error").is_none(), "{response}");
    response["result"].clone()
}
async fn success(app: &Router, name: &str, args: Value) -> Value {
    let result = tool(app, name, args).await;
    assert_eq!(result["isError"], false, "{result}");
    let catalog = beeteam::routes::mcp::catalog();
    let definition = catalog["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|tool| tool["name"] == name)
        .unwrap();
    if let Some(schema) = definition.get("outputSchema") {
        jsonschema::validator_for(schema)
            .unwrap()
            .validate(&result["structuredContent"])
            .unwrap_or_else(|e| panic!("{name} output schema: {e}"));
    }
    result["structuredContent"].clone()
}
#[tokio::test]
async fn sdk_tools_resources_prompts_and_atomic_compounds() {
    let (app, pool) = app_with_pool().await;
    let init=rpc(&app,"initialize",json!({"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1"}})).await;
    assert_eq!(init["result"]["serverInfo"]["name"],"beeteam-mcp");
    let instructions = init["result"]["instructions"].as_str().unwrap();
    assert!(instructions.starts_with("Bee Team local storage."));
    assert!(!instructions.contains("Get Bee Team"));
    assert!(init["result"]["capabilities"].get("resources").is_some());
    assert!(init["result"]["capabilities"].get("prompts").is_some());
    let listing = rpc(&app, "tools/list", json!({})).await;
    let tools = listing["result"]["tools"].as_array().unwrap();
    assert_eq!(tools.len(), 81);
    for tool in tools {
        jsonschema::validator_for(&tool["inputSchema"])
            .unwrap_or_else(|e| panic!("{}: {e}", tool["name"]));
        if let Some(schema) = tool.get("outputSchema") {
            jsonschema::validator_for(schema).unwrap();
        }
    }
    let resources = rpc(&app, "resources/list", json!({})).await;
    for (old,new) in [
        ("beeteam://skills/collaborator","beeteam://skills/worker"),
        ("beeteam://references/collaborator-bootstrap","beeteam://references/worker-bootstrap"),
        ("beeteam://references/collaborator-workflow","beeteam://references/worker-workflow"),
        ("beeteam://references/collaborator-resumption","beeteam://references/worker-resumption"),
    ] {
        assert!(!resources["result"]["resources"].as_array().unwrap().iter().any(|r|r["uri"]==old));
        let legacy = rpc(&app,"resources/read",json!({"uri":old})).await;
        let canonical = rpc(&app,"resources/read",json!({"uri":new})).await;
        assert_eq!(legacy["result"]["contents"][0]["text"],canonical["result"]["contents"][0]["text"]);
        assert!(canonical["result"]["contents"][0]["text"].is_string());
    }
    assert_eq!(
        resources["result"]["resources"].as_array().unwrap().len(),
        17
    );
    for (uri, expected) in [
        (
            "beeteam://references/leader-onboarding-flows",
            include_str!("../resources/bee-team/references/leader-onboarding-flows.md"),
        ),
        (
            "beeteam://references/worker-workflow",
            include_str!("../resources/bee-team/references/worker-workflow.md"),
        ),
    ] {
        assert!(resources["result"]["resources"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["uri"] == uri));
        let read = rpc(&app, "resources/read", json!({"uri":uri})).await;
        assert_eq!(read["result"]["contents"][0]["text"], expected);
        assert!(expected.contains("```mermaid"));
    }
    let provenance: Value =
        serde_json::from_str(include_str!("../resources/bee-team/provenance.json")).unwrap();
    for resource in resources["result"]["resources"].as_array().unwrap() {
        assert!(resource["description"]
            .as_str()
            .unwrap()
            .contains(provenance["sourceCommit"].as_str().unwrap()));
        let read = rpc(&app, "resources/read", json!({"uri":resource["uri"]})).await;
        let uri = resource["uri"].as_str().unwrap();
        let path = match uri {
            "beeteam://skills/leader" => "get-a-team-lead/SKILL.md".to_owned(),
            "beeteam://skills/worker" => "get-a-worker/SKILL.md".to_owned(),
            "beeteam://references/content-manifest" => "prompts/content-manifest.json".to_owned(),
            "beeteam://references/team-examples" => {
                "get-a-team-lead/references/team-examples.md".to_owned()
            }
            _ => {
                let name = uri.rsplit('/').next().unwrap();
                if [
                    "task-briefing",
                    "worker-resumption",
                    "delivery-review",
                ]
                .contains(&name)
                {
                    format!("prompts/{name}.md")
                } else {
                    format!("references/{name}.md")
                }
            }
        };
        if let Some(expected) = provenance["files"]
            .as_array()
            .unwrap()
            .iter()
            .find(|f| f["resourcePath"] == path)
        {
            let text = read["result"]["contents"][0]["text"].as_str().unwrap();
            assert_eq!(
                Sha256::digest(text.as_bytes())
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect::<String>(),
                expected["bundledSha256"].as_str().unwrap(),
                "{uri}"
            );
        }
        assert!(
            read["result"]["contents"][0]["text"]
                .as_str()
                .unwrap()
                .len()
                > 100
        );
    }
    assert!(rpc(
        &app,
        "resources/read",
        json!({"uri":"file:///C:/Users/phili/.ssh/id_rsa"})
    )
    .await
    .get("error")
    .is_some());
    let agent=success(&app,"createAgent",json!({"body":{"name":"MCP agent"},"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4()})).await["data"].clone();
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"MCP team","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"MCP board","teamId":id(&team)}),
        None,
    )
    .await;
    let task=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"MCP task","specification":"# Requirements\r\n- **Acceptance**\r\n","workScope":test_project_scope(),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await;
    let child=ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":"Child","specification":"## Child requirements\n- [ ] Acceptance","parentId":id(&task),"workScope":test_project_scope(),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),ver(&task)).await;
    let task = get(&app, &format!("/api/v1/tasks/{}", id(&task))).await;
    for (name, entity) in [
        ("resolveAgentSlug", &agent),
        ("resolveTeamSlug", &team),
        ("resolveTaskSlug", &task),
    ] {
        let resolved = success(&app, name, json!({"params":{"slug":entity["slug"]}})).await;
        assert_eq!(
            resolved["data"],
            json!({"id":entity["id"],"slug":entity["slug"]})
        );
    }

    let prepared = success(&app, "prepare_execution", json!({"taskId":id(&task)})).await;
    assert_eq!(prepared["task"]["version"], task["version"]);
    assert_eq!(prepared["executionContext"]["effectiveMode"], "manual");
    assert_eq!(prepared["children"]["total"], 1);
    assert_eq!(prepared["task"]["specification"], task["specification"]);
    assert_eq!(
        prepared["children"]["items"][0]["specification"],
        child["specification"]
    );
    let mut changes = sqlx::postgres::PgListener::connect_with(&pool)
        .await
        .unwrap();
    changes
        .listen(beeteam::repositories::changes::CHANNEL)
        .await
        .unwrap();
    let failed=tool(&app,"record_progress",json!({"taskId":id(&task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must rollback","subtaskUpdates":[{"taskId":id(&child),"expectedVersion":999,"currentSummary":"Child: half done; completing implementation; tests pending.","progress":{"percent":50,"note":"Half"}}]})).await;
    assert_eq!(failed["isError"], true);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(&task))).await["total"],
        0
    );
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(100), changes.recv())
            .await
            .is_err()
    );
    let input = json!({"taskId":id(&task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Progress","currentSummary":"Root: planning done; implementation underway; tests next.","progress":{"percent":20,"note":"Started"},"subtaskUpdates":[{"taskId":id(&child),"expectedVersion":child["version"],"currentSummary":"Child: half done; completing implementation; tests pending.","progress":{"percent":50,"note":"Half"}}]});
    let result = success(&app, "record_progress", input.clone()).await;
    tokio::time::timeout(std::time::Duration::from_secs(2), changes.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(result["task"]["progress"]["percent"], 20);
    assert_eq!(result["task"]["currentSummary"], input["currentSummary"]);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(&child))).await["currentSummary"],
        input["subtaskUpdates"][0]["currentSummary"]
    );
    let mut conflict = input.clone();
    conflict["currentSummary"] = json!("Different synthesis with same idempotency key");
    assert_eq!(
        tool(&app, "record_progress", conflict).await["isError"],
        true
    );
    assert_eq!(success(&app, "record_progress", input).await, result);
    assert!(
        tokio::time::timeout(std::time::Duration::from_millis(100), changes.recv())
            .await
            .is_err()
    );
    let task = &result["task"];
    let missing=tool(&app,"record_progress",json!({"taskId":id(task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"progress":{"percent":25,"note":"missing synthesis"}})).await;
    assert_eq!(missing["isError"], true);
    let failed=tool(&app,"close_activity",json!({"taskId":id(task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"comment":"Must rollback too","execution":{"currentSummary":"Must roll back this synthesis.","commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(task["executorAgentId"].as_str().unwrap()),"summary":"Wrong context","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(&child),"originBoardId":id(&board)}}})).await;
    assert_eq!(failed["isError"], true);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(task))).await["currentSummary"],
        task["currentSummary"]
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments", id(task))).await["total"],
        1
    );
    let result=success(&app,"close_activity",json!({"taskId":id(task),"expectedVersion":task["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"execution":{"currentSummary":"Root: implementation done; validation underway; review next.","commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(task["executorAgentId"].as_str().unwrap()),"summary":"Partial work","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":["Next step"],"executionContext":{"rootTaskId":id(task),"originBoardId":id(&board)}}})).await;
    assert_eq!(result["task"]["statusId"], task["statusId"]);
    assert_eq!(
        result["task"]["currentSummary"],
        "Root: implementation done; validation underway; review next."
    );
    let summaries = get(
        &app,
        &format!("/api/v1/tasks/{}/execution-summaries", id(task)),
    )
    .await;
    assert_eq!(summaries["total"], 1);
    let malformed=tool(&app,"createAttachment",json!({"params":{"taskId":id(task)},"body":{"description":42},"actor":{"kind":"human"},"expectedVersion":result["task"]["version"],"idempotencyKey":uuid::Uuid::new_v4(),"upload":{"name":"file.txt","mediaType":"text/plain","dataBase64":"YQ=="}})).await;
    assert_eq!(
        malformed["isError"], true,
        "MCP must enforce the same multipart metadata schema as HTTP"
    );
    for name in ["record_progress", "close_activity"] {
        let key = uuid::Uuid::new_v4();
        let mut legacy = json!({"taskId":id(task),"expectedVersion":1,"actor":{"kind":"human"},"idempotencyKey":key});
        if name == "record_progress" {
            legacy["progress"] = json!({"percent":10,"note":"Old update"});
            legacy["subtaskUpdates"] = json!([{"taskId":id(&child),"expectedVersion":1,"progress":{"percent":10,"note":"Old child update"}}]);
        } else {
            legacy["execution"] = json!({"summary":"Old historical summary","outcome":"progress","statusId":task["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(task),"originBoardId":id(&board)}});
        }
        let mut old_task = task.clone();
        old_task.as_object_mut().unwrap().remove("currentSummary");
        old_task.as_object_mut().unwrap().remove("specification");
        old_task.as_object_mut().unwrap().remove("slug");
        let snapshot =
            json!({"task":old_task,"updatedTasks":[old_task],"notice":"Stored atomically."});
        legacy_replay(
            &pool,
            &format!("{name}:{}", id(task)),
            key,
            legacy.clone(),
            snapshot,
        )
        .await;
        let path = format!("/api/v1/tasks/{}", id(task));
        let before = get(&app, &format!("{path}/timeline")).await;
        let current = get(&app, &path).await;
        let replayed = success(&app, name, legacy.clone()).await;
        assert_eq!(replayed["task"]["currentSummary"], "");
        assert_eq!(replayed["task"]["specification"], "");
        assert_eq!(replayed["task"]["slug"], task["slug"]);
        assert_eq!(replayed["task"]["version"], task["version"]);
        assert_eq!(get(&app, &path).await, current);
        assert_eq!(get(&app, &format!("{path}/timeline")).await, before);
        legacy["idempotencyKey"] = json!(uuid::Uuid::new_v4());
        assert_eq!(tool(&app, name, legacy).await["isError"], true);
    }
    // A late descendant failure must roll back the root synthesis already staged.
    let live_root = get(&app, &format!("/api/v1/tasks/{}", id(task))).await;
    let live_child = get(&app, &format!("/api/v1/tasks/{}", id(&child))).await;
    let archived = ok(
        &app,
        "PUT",
        &format!("/api/v1/tasks/{}/archive", id(&child)),
        json!({"archived":true}),
        ver(&live_child),
    )
    .await;
    let before = get(&app, &format!("/api/v1/tasks/{}/timeline", id(task))).await;
    let failed=tool(&app,"record_progress",json!({"taskId":id(task),"expectedVersion":live_root["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"currentSummary":"Must not persist root synthesis","subtaskUpdates":[{"taskId":id(&child),"expectedVersion":archived["version"],"currentSummary":"Cannot update archived child"}]})).await;
    assert_eq!(failed["isError"], true);
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}", id(task))).await,
        live_root
    );
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/timeline", id(task))).await,
        before
    );
    let spec_markdown = "# Delivery\r\n- [ ] **Acceptance**\r\n```text\r\nliteral\r\n```";
    let spec_task=success(&app,"createTask",json!({"params":{"boardId":id(&board)},"body":{"title":"Specification task","specification":spec_markdown,"workScope":test_project_scope(),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()},"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4()})).await["data"].clone();
    assert_eq!(spec_task["specification"], spec_markdown);
    let updated=success(&app,"updateTask",json!({"params":{"taskId":id(&spec_task)},"body":{"specification":"## Revised requirements\n- Rule"},"actor":{"kind":"human"},"expectedVersion":spec_task["version"]})).await["data"].clone();
    assert_eq!(updated["currentSummary"], "");
    let context = success(&app, "prepare_execution", json!({"taskId":id(&spec_task)})).await;
    assert_eq!(context["task"]["specification"], updated["specification"]);
    let prompts = rpc(&app, "prompts/list", json!({})).await;
    assert_eq!(prompts["result"]["prompts"].as_array().unwrap().len(), 2);
    for (name, args) in [
        ("task_briefing", json!({"taskId":id(task)})),
        ("delivery_review", json!({"taskId":id(task)})),
    ] {
        let prompt = rpc(&app, "prompts/get", json!({"name":name,"arguments":args})).await;
        assert!(prompt.get("error").is_none(), "{prompt}");
        let text = prompt["result"]["messages"][0]["content"]["text"]
            .as_str()
            .unwrap();
        assert!(text.contains("originBoardId"));
        assert!(text.contains("In the implemented MCP"));
        assert!(text.contains(name));
        assert!(text.contains("specification"));
        assert!(
            text.contains("This result is read context, not a dispatch message between agents.")
        );
        assert!(!text.contains("{{taskId}}"));
    }
}

#[tokio::test]
async fn exact_comment_lookup_and_compound_receipts() {
    let app = app().await;
    let agent = ok(
        &app,
        "POST",
        "/api/v1/agents",
        json!({"name":"Comment reader"}),
        None,
    )
    .await;
    let team = ok(
        &app,
        "POST",
        "/api/v1/teams",
        json!({"name":"Comments","leaderId":id(&agent),"coordinationContext":manual()}),
        None,
    )
    .await;
    let board = ok(
        &app,
        "POST",
        "/api/v1/boards",
        json!({"name":"Comments","teamId":id(&team)}),
        None,
    )
    .await;
    let mut tasks = Vec::new();
    for title in ["First", "Other"] {
        tasks.push(ok(&app,"POST",&format!("/api/v1/boards/{}/tasks",id(&board)),json!({"title":title,"workScope":test_project_scope(),"authorAgentId":id(&agent),"executorAgentId":id(&agent),"coordinationContext":manual()}),None).await);
    }
    let task = &tasks[0];
    let created = success(&app,"createComment",json!({"params":{"taskId":id(task)},"body":{"body":"Exact **Markdown**"},"actor":{"kind":"human"},"expectedVersion":task["version"],"idempotencyKey":uuid::Uuid::new_v4()})).await;
    let cid = created["createdId"].as_str().unwrap();
    assert_eq!(created["data"]["id"], cid);
    let args = json!({"params":{"taskId":id(task),"commentId":cid}});
    let found = success(&app, "getComment", args.clone()).await;
    // PostgreSQL persists row timestamps in microseconds, while the immediate
    // mutation response can retain nanoseconds. All other data stays exact.
    let mut expected = created["data"].clone();
    let written = chrono::DateTime::parse_from_rfc3339(expected["createdAt"].as_str().unwrap()).unwrap();
    let stored = chrono::DateTime::parse_from_rfc3339(found["data"]["createdAt"].as_str().unwrap()).unwrap();
    assert_eq!(written.timestamp_micros(), stored.timestamp_micros());
    expected["createdAt"] = found["data"]["createdAt"].clone();
    assert_eq!(found["data"], expected);
    assert_eq!(found["version"], 1);
    assert!(found["createdId"].is_null());
    assert_eq!(
        get(&app, &format!("/api/v1/tasks/{}/comments/{cid}", id(task))).await,
        found["data"]
    );
    for (tid, missing) in [
        (id(&tasks[1]).to_owned(), cid.to_owned()),
        (id(task).to_owned(), uuid::Uuid::now_v7().to_string()),
        (uuid::Uuid::now_v7().to_string(), cid.to_owned()),
    ] {
        assert_eq!(
            tool(
                &app,
                "getComment",
                json!({"params":{"taskId":tid,"commentId":missing}})
            )
            .await["isError"],
            true
        );
        assert_eq!(
            request(
                &app,
                "GET",
                &format!("/api/v1/tasks/{tid}/comments/{missing}"),
                json!({}),
                None
            )
            .await
            .0,
            404
        );
    }
    assert_eq!(
        tool(
            &app,
            "getComment",
            json!({"params":{"taskId":id(task),"commentId":"invalid"}})
        )
        .await["isError"],
        true
    );
    let parent = get(&app, &format!("/api/v1/tasks/{}", id(task))).await;
    let child = ok(&app, "POST", &format!("/api/v1/boards/{}/tasks", id(&board)), json!({"title":"Child receipt", "parentId":id(task), "workScope":test_project_scope(),"authorAgentId":id(&agent), "executorAgentId":id(&agent), "coordinationContext":manual()}), ver(&parent)).await;
    for name in ["record_progress", "close_activity"] {
        let live = get(&app, &format!("/api/v1/tasks/{}", id(task))).await;
        let mut input = json!({"taskId":id(task),"expectedVersion":live["version"],"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4(),"comment":name});
        if name == "close_activity" {
            input["execution"] = json!({"currentSummary":"Stored test summary","commitReport":{"hasCommits":false,"commits":[]},"usageReport":session_usage(task["executorAgentId"].as_str().unwrap()),"summary":"Test only","outcome":"progress","statusId":live["statusId"],"deliverables":[],"pending":[],"executionContext":{"rootTaskId":id(task),"originBoardId":id(&board)}});
        }
        if name == "record_progress" {
            input["subtaskUpdates"] = json!([{"taskId":id(&child),"expectedVersion":child["version"],"comment":"Child receipt"}]);
        }
        let result = success(&app, name, input.clone()).await;
        assert_eq!(
            result["createdComments"].as_array().unwrap().len(),
            if name == "record_progress" { 2 } else { 1 }
        );
        if name == "record_progress" {
            let receipt = &result["createdComments"][1];
            assert_eq!(receipt["taskId"], child["id"]);
            assert_eq!(
                success(&app, "getComment", json!({"params":receipt})).await["data"]["body"],
                "Child receipt"
            );
        }
        let receipt = &result["createdComments"][0];
        let read = success(&app, "getComment", json!({"params":receipt})).await;
        assert_eq!(read["data"]["body"], name);
        assert_eq!(read["data"]["taskId"], task["id"]);
        assert_eq!(success(&app, name, input).await, result);
    }
    assert_eq!(success(&app, "getComment", args).await, found);
}

#[tokio::test]
async fn bundled_comment_protocol_catalog_and_hashes() {
    let app = app().await;
    let listing = rpc(&app, "tools/list", json!({})).await;
    let tools = listing["result"]["tools"].as_array().unwrap();
    assert_eq!(tools.len(), 81);
    for tool in tools {
        jsonschema::validator_for(&tool["inputSchema"]).unwrap();
        if let Some(schema) = tool.get("outputSchema") {
            jsonschema::validator_for(schema).unwrap();
        }
    }
    let resources = rpc(&app, "resources/list", json!({})).await;
    for (uri, name, invocation) in [
        (
            "beeteam://skills/leader",
            "Get a Team Lead",
            "get-a-team-lead",
        ),
        (
            "beeteam://skills/worker",
            "Get a Worker",
            "get-a-worker",
        ),
    ] {
        let matches: Vec<_> = resources["result"]["resources"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|r| r["uri"] == uri)
            .collect();
        assert_eq!(matches.len(), 1, "stable skill URI must remain unique");
        assert_eq!(matches[0]["name"], name);
        let read = rpc(&app, "resources/read", json!({"uri":uri})).await;
        let content = read["result"]["contents"][0]["text"].as_str().unwrap();
        assert!(content.starts_with(&format!("---\nname: {invocation}\n")));
        assert!(content.contains(&format!("\n# {name}\n")));
        assert!(!content.contains("name: bee-team-"));
    }
    assert_eq!(
        resources["result"]["resources"].as_array().unwrap().len(),
        17
    );
    let provenance: Value =
        serde_json::from_str(include_str!("../resources/bee-team/provenance.json")).unwrap();
    let source = provenance["sourceCommit"].as_str().unwrap();
    assert_eq!(source.len(), 40);
    assert!(source.bytes().all(|b| b.is_ascii_hexdigit()));
    for file in provenance["files"].as_array().unwrap() {
        let path = file["resourcePath"].as_str().unwrap();
        let uri = match path {
            "get-a-team-lead/SKILL.md" => "beeteam://skills/leader".to_owned(),
            "get-a-worker/SKILL.md" => "beeteam://skills/worker".to_owned(),
            "prompts/content-manifest.json" => "beeteam://references/content-manifest".to_owned(),
            _ => format!(
                "beeteam://references/{}",
                path.rsplit('/').next().unwrap().trim_end_matches(".md")
            ),
        };
        let read = rpc(&app, "resources/read", json!({"uri":uri})).await;
        let text = read["result"]["contents"][0]["text"].as_str().unwrap();
        let hash = Sha256::digest(text.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        assert_eq!(hash, file["bundledSha256"].as_str().unwrap(), "{uri}");
    }
    assert_eq!(
        rpc(&app, "prompts/list", json!({})).await["result"]["prompts"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}
