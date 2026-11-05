#[allow(dead_code)]
#[path = "../build_frontend.rs"]
mod build_frontend;

use std::{fs, path::Path, process::Command};

fn node_hash(root: &Path) -> String {
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("frontend/scripts/build-inputs.mjs");
    let result = Command::new("node")
        .args(["--input-type=module", "-e", "import {pathToFileURL} from 'node:url'; const {sourceHash}=await import(pathToFileURL(process.argv[1])); console.log(sourceHash(process.argv[2]));"])
        .arg(script).arg(root).output().expect("Node is required for packaging regression tests");
    assert!(result.status.success(), "{}", String::from_utf8_lossy(&result.stderr));
    String::from_utf8(result.stdout).unwrap().trim().into()
}

#[test]
fn catalog_only_change_invalidates_embedded_manifest_with_node_rust_hash_parity() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("frontend");
    for name in ["src", "public", "scripts"] {
        fs::create_dir_all(root.join(name)).unwrap();
        fs::write(root.join(name).join("fixture.txt"), name).unwrap();
    }
    for name in ["package.json", "package-lock.json", "index.html", "vite.config.ts", "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json"] {
        fs::write(root.join(name), name).unwrap();
    }
    let catalog = temp.path().join("docs/team-role-icons.json");
    fs::create_dir_all(catalog.parent().unwrap()).unwrap();
    fs::write(&catalog, "[{\"id\":\"crown\"}]\n").unwrap();
    fs::write(temp.path().join("Cargo.toml"), "[package]\nversion=\"0.1.0\"\n").unwrap();
    let mcp_catalog = temp.path().join("docs/mcp-catalog.json");
    fs::write(&mcp_catalog, r#"{"tools":[]}"#).unwrap();
    let before = node_hash(&root);
    assert_eq!(before, build_frontend::source_hash(&root));
    let manifest = serde_json::json!({"sourceHash":before});
    build_frontend::verify_source_hash(&manifest, &root);
    fs::write(&catalog, "[{\"id\":\"rocket\"}]\n").unwrap();
    let after = node_hash(&root);
    assert_ne!(after, before);
    assert_eq!(after, build_frontend::source_hash(&root));
    assert!(std::panic::catch_unwind(|| build_frontend::verify_source_hash(&manifest, &root)).is_err());
    fs::write(mcp_catalog, r#"{"tools":[{}]}"#).unwrap();
    let mcp_changed = node_hash(&root);
    assert_ne!(mcp_changed, after);
    assert_eq!(mcp_changed, build_frontend::source_hash(&root));
    fs::write(temp.path().join("Cargo.toml"), "[package]\nversion=\"0.2.0\"\n").unwrap();
    let cargo_changed = node_hash(&root);
    assert_ne!(cargo_changed, after);
    assert_eq!(cargo_changed, build_frontend::source_hash(&root));
}
