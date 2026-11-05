use regex::Regex;
use serde_json::Value;
use std::{collections::BTreeSet, fs, path::Path};

fn runtime_settings(dir: &Path, pattern: &Regex, names: &mut BTreeSet<String>) {
    for entry in fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            runtime_settings(&path, pattern, names);
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            let contents = fs::read_to_string(path).unwrap();
            let production = contents.split("#[cfg(test)]").next().unwrap();
            for capture in pattern.captures_iter(production) {
                names.insert(capture[1].to_string());
            }
        }
    }
}

#[test]
fn guide_lists_every_application_setting_read_from_the_environment() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let pattern =
        Regex::new(r#"(?:env::var(?:_os)?|parse_env_bool|number)\(\s*"([A-Z][A-Z0-9_]+)""#)
            .unwrap();
    let mut actual = BTreeSet::new();
    runtime_settings(&root.join("src"), &pattern, &mut actual);
    // EnvFilter::try_from_default_env reads RUST_LOG in tracing-subscriber.
    actual.insert("RUST_LOG".into());
    let groups: Value = serde_json::from_str(include_str!(
        "../docs/runtime-environment-settings.json"
    ))
    .unwrap();
    let documented: BTreeSet<_> = groups
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|group| group["rows"].as_array().unwrap())
        .map(|row| row[0].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(actual, documented);
}

#[test]
fn platform_discovery_inputs_are_documented() {
    let mut actual: BTreeSet<String> = ["HOME", "USERPROFILE"]
        .into_iter()
        .map(String::from)
        .collect();
    let git = include_str!("../src/repositories/local_git.rs");
    let keys = git
        .split_once("for key in [")
        .unwrap()
        .1
        .split_once(']')
        .unwrap()
        .0;
    let quoted = Regex::new(r#""([^"]+)""#).unwrap();
    actual.extend(
        quoted
            .captures_iter(keys)
            .map(|capture| capture[1].to_string()),
    );
    let apps = include_str!("../src/repositories/local_projects.rs");
    let locations = apps
        .split_once("let locations:")
        .unwrap()
        .1
        .split_once("};")
        .unwrap()
        .0;
    let root_name = Regex::new(r#"\("([^"]+)",\s*""#).unwrap();
    actual.extend(
        root_name
            .captures_iter(locations)
            .map(|capture| capture[1].to_string()),
    );

    let groups: Value = serde_json::from_str(include_str!(
        "../docs/runtime-platform-inputs.json"
    ))
    .unwrap();
    let platform = groups
        .as_array()
        .unwrap()
        .iter()
        .find(|group| group["label"][0] == "Operating system inputs")
        .unwrap();
    let documented: BTreeSet<String> = platform["rows"]
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|row| row[0].as_str().unwrap().split(" / ").map(String::from))
        .collect();
    assert_eq!(actual, documented);
}

#[cfg(feature = "mcp")]
#[test]
fn versioned_tool_schemas_resources_and_prompts_match_the_running_catalog() {
    let documented: Value = serde_json::from_str(include_str!("../docs/mcp-catalog.json")).unwrap();
    assert!(beeteam::routes::mcp::catalog() == documented, "Regenerate docs/mcp-catalog.json with the mcp_catalog example");
}
