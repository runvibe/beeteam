use crate::dto::team_role_icons::{self as dto, CATALOG};
use serde_json::{json, Value};

pub(super) fn catalog() -> Value {
    json!({"items": *CATALOG})
}

pub(super) fn defaults(team: &mut Value) {
    for (field, default) in [
        ("leaderIconId", dto::LEADER_DEFAULT),
        ("collaboratorIconId", dto::COLLABORATOR_DEFAULT),
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
        "collaborator": dto::icon(team["collaboratorIconId"].as_str().unwrap_or(dto::COLLABORATOR_DEFAULT)),
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
        assert_eq!(team["roleIcons"]["collaborator"]["id"], "user-round");
        team["leaderIconId"] = json!("rocket");
        resolve(&mut team);
        assert_eq!(team["roleIcons"]["leader"]["unicode"], "🚀");
        assert_eq!(team["collaboratorIconId"], "user-round");
    }
}
