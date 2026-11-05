use crate::dto::team_role_icons::{self as dto, CATALOG};
use serde_json::{json, Value};

pub(super) fn catalog() -> Value {
    json!({"items": *CATALOG})
}

pub(super) fn defaults(team: &mut Value) {
    if team.get("workerIconId").is_none() {
        if let Some(icon) = team.get("collaboratorIconId").cloned() { team["workerIconId"] = icon; }
    }
    team.as_object_mut().unwrap().remove("collaboratorIconId");
    for (field, default) in [
        ("leaderIconId", dto::LEADER_DEFAULT),
        ("workerIconId", dto::WORKER_DEFAULT),
    ] {
        if team.get(field).is_none() {
            team[field] = json!(default);
        }
    }
}

// Resolve on the service read boundary; legacy stored JSON stays untouched.
pub(super) fn resolve(team: &mut Value) {
    defaults(team);
    team["roleIcons"] = json!({
        "leader": dto::icon(team["leaderIconId"].as_str().unwrap_or(dto::LEADER_DEFAULT)),
        "worker": dto::icon(team["workerIconId"].as_str().unwrap_or(dto::WORKER_DEFAULT)),
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_defaults_and_independent_roles() {
        let mut team = json!({"name":"Legacy"});
        resolve(&mut team);
        assert_eq!(team["roleIcons"]["leader"]["unicode"], "👑");
        assert_eq!(team["roleIcons"]["worker"]["id"], "user-round");
        team["leaderIconId"] = json!("rocket");
        resolve(&mut team);
        assert_eq!(team["roleIcons"]["leader"]["unicode"], "🚀");
        assert_eq!(team["workerIconId"], "user-round");
    }
}
