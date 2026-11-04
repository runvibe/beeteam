#![cfg(feature = "mcp")]
mod support;
use axum::{body::Body, http::Request, Router};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use support::*;
use tower::ServiceExt;

async fn tool(app: &Router, name: &str, arguments: Value) -> Value {
    let response = app.clone().oneshot(Request::post("/mcp")
        .header("host", "127.0.0.1").header("content-type", "application/json")
        .header("accept", "application/json, text/event-stream")
        .header("mcp-protocol-version", "2025-11-25")
        .body(Body::from(json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":name,"arguments":arguments}}).to_string())).unwrap()).await.unwrap();
    let result: Value = serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    result["result"].clone()
}

#[tokio::test]
async fn catalog_and_team_icons_have_http_mcp_parity() {
    let app = app().await;
    let catalog = get(&app, "/api/v1/team-role-icons").await;
    let mcp = tool(&app, "listTeamRoleIcons", json!({})).await;
    assert_eq!(mcp["isError"], false, "{mcp}");
    assert_eq!(catalog, mcp["structuredContent"]["data"]);
    let bundled: Value = serde_json::from_str(include_str!("../docs/team-role-icons.json")).unwrap();
    assert_eq!(catalog["items"], bundled);
    let agent = ok(&app,"POST","/api/v1/agents",json!({"name":"Icon leader"}),None).await;
    let body = json!({"name":"Icon team","leaderId":id(&agent),"leaderIconId":"rocket","collaboratorIconId":"shield","coordinationContext":manual()});
    let mcp = tool(&app,"createTeam",json!({"body":body,"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4()})).await;
    assert_eq!(mcp["isError"], false, "{mcp}");
    let team = mcp["structuredContent"]["data"].clone();
    let path = format!("/api/v1/teams/{}", id(&team));
    assert_eq!(team, get(&app, &path).await);
    assert_eq!(team["roleIcons"]["leader"]["unicode"], "🚀");
    assert_eq!(team["roleIcons"]["collaborator"]["id"], "shield");
    let team = ok(&app,"PATCH",&path,json!({"leaderIconId":"compass"}),ver(&team)).await;
    assert_eq!(team["collaboratorIconId"], "shield");
    assert_eq!(team, tool(&app,"getTeam",json!({"params":{"teamId":id(&team)}})).await["structuredContent"]["data"]);
    let mcp = tool(&app,"updateTeam",json!({"params":{"teamId":id(&team)},"body":{"purpose":"Unrelated change","collaboratorIconId":"wrench"},"actor":{"kind":"human"},"expectedVersion":team["version"]})).await;
    assert_eq!(mcp["isError"], false, "{mcp}");
    let team = get(&app, &path).await;
    assert_eq!(team["leaderIconId"], "compass");
    assert_eq!(team["roleIcons"]["collaborator"]["id"], "wrench");
    assert_eq!(get(&app,"/api/v1/teams").await["items"][0], team);
    for invalid in [json!(null), json!("unknown"), json!("<svg/>"), json!("crown\n"), json!(42)] {
        let patch = json!({"leaderIconId":invalid});
        assert_eq!(request(&app,"PATCH",&path,patch.clone(),ver(&team)).await.0,400);
        let mcp = tool(&app,"updateTeam",json!({"params":{"teamId":id(&team)},"body":patch,"actor":{"kind":"human"},"expectedVersion":team["version"]})).await;
        assert_eq!(mcp["isError"], true, "{mcp}");
    }
    assert_eq!(get(&app,&path).await,team);
}

#[tokio::test]
async fn legacy_team_read_defaults_do_not_modify_persisted_json() {
    use beeteam::repositories::{records::Record};
    let (app, pool) = sqlite_app_with_pool().await;
    let repository = beeteam::repositories::sqlite::ResourceRepository::new(pool);
    let agent = ok(&app,"POST","/api/v1/agents",json!({"name":"Legacy leader"}),None).await;
    let mut unit = repository.begin().await.unwrap();
    let data = json!({"name":"Legacy","slug":"legacy","leaderId":id(&agent),"purpose":"","context":""});
    let team_id = unit.records.insert(Record::new("teams", data.clone()));
    unit.commit().await.unwrap();
    let team = get(&app,&format!("/api/v1/teams/{team_id}")).await;
    assert_eq!(team["leaderIconId"], "crown");
    assert_eq!(team["collaboratorIconId"], "user-round");
    assert_eq!(team["roleIcons"]["leader"]["unicode"], "👑");
    let unit = repository.begin().await.unwrap();
    assert_eq!(unit.records.get("teams", team_id).unwrap().data, data);
    unit.rollback().await.unwrap();
}

#[tokio::test]
async fn http_create_defaults_and_invalid_roles_match_mcp_validation() {
    let app = app().await;
    let agent = ok(&app,"POST","/api/v1/agents",json!({"name":"Default leader"}),None).await;
    let body = json!({"name":"Defaults","leaderId":id(&agent),"coordinationContext":manual()});
    for field in ["leaderIconId", "collaboratorIconId"] {
        for invalid in [Value::Null, json!("bad\u{202e}icon")] {
            let mut invalid_body = body.clone();
            invalid_body[field] = invalid;
            assert_eq!(request(&app,"POST","/api/v1/teams",invalid_body.clone(),None).await.0,400);
            let mcp = tool(&app,"createTeam",json!({"body":invalid_body,"actor":{"kind":"human"},"idempotencyKey":uuid::Uuid::new_v4()})).await;
            assert_eq!(mcp["isError"],true,"{mcp}");
        }
    }
    let team = ok(&app,"POST","/api/v1/teams",body,None).await;
    assert_eq!(team["leaderIconId"],"crown");
    assert_eq!(team["collaboratorIconId"],"user-round");
    let updated = ok(&app,"PATCH",&format!("/api/v1/teams/{}",id(&team)),json!({"name":"Preserve defaults"}),ver(&team)).await;
    assert_eq!(updated["roleIcons"],team["roleIcons"]);
}

#[test]
fn skill_sources_and_bundles_require_team_lookup_and_honest_readback() {
    use sha2::{Digest, Sha256};
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let provenance: Value = serde_json::from_str(include_str!("../resources/bee-team/provenance.json")).unwrap();
    for entry in provenance["files"].as_array().unwrap() {
        let source = std::fs::read(root.join(entry["sourcePath"].as_str().unwrap())).unwrap();
        let bundled = std::fs::read(root.join("resources/bee-team").join(entry["resourcePath"].as_str().unwrap())).unwrap();
        assert_eq!(Sha256::digest(&source).iter().map(|b| format!("{b:02x}")).collect::<String>(),entry["sourceSha256"]);
        assert_eq!(Sha256::digest(&bundled).iter().map(|b| format!("{b:02x}")).collect::<String>(),entry["bundledSha256"]);
        if entry["resourcePath"].as_str().unwrap().ends_with("SKILL.md") {
            for bytes in [&source, &bundled] {
                let text = std::str::from_utf8(bytes).unwrap();
                for requirement in ["actual team and active role", "listTeamRoleIcons", "If already correct, do not write", "Read back", "never rename someone else's existing chat", "fallback"] {
                    assert!(text.contains(requirement),"Missing {requirement}");
                }
                assert!(!text.contains("before resolving identity"));
            }
        }
    }
}

#[test]
fn closed_catalog_matches_validation_and_has_safe_representations() {
    use beeteam::dto::{contracts, team_role_icons::CATALOG};
    let op = contracts::operation("createTeam").unwrap();
    let ids = op.document["components"]["schemas"]["TeamRoleIconId"]["enum"].as_array().unwrap();
    assert_eq!(ids.len(), CATALOG.len());
    assert_eq!(CATALOG.len(), 24);
    let unique: std::collections::HashSet<_> = CATALOG.iter().map(|icon| &icon.id).collect();
    assert_eq!(unique.len(), CATALOG.len());
    for icon in CATALOG.iter() {
        assert!(ids.contains(&json!(icon.id)));
        assert!(icon.name.is_ascii());
        assert!(!icon.unicode.is_empty());
        assert!(icon.unicode.chars().all(|c| !c.is_control() && !c.is_whitespace() && !matches!(c as u32, 0x200b..=0x200f | 0x202a..=0x202e | 0x2060..=0x206f)));
        assert!(icon.svg.starts_with("<svg xmlns=\"http://www.w3.org/2000/svg\""));
        assert!(icon.svg.contains("stroke=\"currentColor\""));
        for forbidden in ["<script", "<foreignObject", "href=", "style=", "onload=", "<image"] {
            assert!(!icon.svg.contains(forbidden));
        }
    }
}

#[tokio::test]
async fn every_catalog_choice_round_trips_through_http_and_mcp() {
    use beeteam::dto::team_role_icons::CATALOG;
    let app = app().await;
    let agent = ok(&app,"POST","/api/v1/agents",json!({"name":"Expanded icons leader"}),None).await;
    let mut team = ok(&app,"POST","/api/v1/teams",json!({"name":"Expanded icons","leaderId":id(&agent),"coordinationContext":manual()}),None).await;
    let path = format!("/api/v1/teams/{}",id(&team));
    for icon in CATALOG.iter() {
        team = ok(&app,"PATCH",&path,json!({"leaderIconId":icon.id}),ver(&team)).await;
        assert_eq!(team["roleIcons"]["leader"],serde_json::to_value(icon).unwrap());
        let result = tool(&app,"updateTeam",json!({"params":{"teamId":id(&team)},"body":{"collaboratorIconId":icon.id},"actor":{"kind":"human"},"expectedVersion":team["version"]})).await;
        assert_eq!(result["isError"],false,"{result}");
        team = get(&app,&path).await;
        assert_eq!(team["roleIcons"]["leader"],team["roleIcons"]["collaborator"]);
        assert_eq!(team,result["structuredContent"]["data"]);
    }
}
