use beeteam::dto::session_bindings::Session;
use serde_json::json;

#[test]
fn generic_declared_bindings_default_external_and_accept_explicit_external() {
    let base = json!({"harness":"codex","installationId":"test","externalId":"desktop-thread","projectRoot":"/project"});
    let legacy: Session = serde_json::from_value(base.clone()).unwrap();
    legacy.validate().unwrap();
    assert_eq!(serde_json::to_value(legacy).unwrap()["mode"], "external");
    let mut explicit = base;
    explicit["mode"] = json!("external");
    serde_json::from_value::<Session>(explicit)
        .unwrap()
        .validate()
        .unwrap();
}

#[test]
fn declaring_an_external_chat_cannot_make_it_beeteam_managed() {
    let payload = json!({"harness":"codex","installationId":"test","externalId":"desktop-thread","projectRoot":"/project","mode":"integrated"});
    let result = serde_json::from_value::<Session>(payload);
    assert!(result.map_or(true, |s| s.validate().is_err()));
}
