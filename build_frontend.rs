use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
fn files(path: &Path, out: &mut Vec<PathBuf>) {
    let metadata = fs::symlink_metadata(path)
        .expect("embedded UI input missing; run npm ci and npm run build:embedded in frontend");
    assert!(
        !metadata.file_type().is_symlink(),
        "embedded UI inputs cannot be symlinks"
    );
    if metadata.is_dir() {
        for item in fs::read_dir(path).unwrap() {
            files(&item.unwrap().path(), out);
        }
    } else {
        out.push(path.into());
    }
}
fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
pub fn generate() {
    let root = PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap()).join("frontend");
    println!("cargo:rerun-if-env-changed=BEE_FRONTEND_DIST");
    let dist = std::env::var_os("BEE_FRONTEND_DIST")
        .map(|value| {
            let path = PathBuf::from(value);
            if path.is_absolute() {
                path
            } else {
                root.parent().unwrap().join(path)
            }
        })
        .unwrap_or_else(|| root.join("dist"));
    println!("cargo:rerun-if-changed={}", dist.display());
    let manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(dist.join(".beeteam-build.json")).expect(
            "Missing embedded frontend build; run npm ci and npm run build:embedded in frontend",
        ))
        .unwrap();
    verify_source_hash(&manifest, &root);
    verify_site_sources(&manifest, root.parent().unwrap());
    assert_eq!(manifest["nodeEnv"], "production");
    assert_eq!(manifest["apiMode"], "http");
    assert_eq!(manifest["apiBase"], "/api/v1");
    let mut actual = Vec::new();
    files(&dist, &mut actual);
    actual.retain(|p| p.file_name().unwrap() != ".beeteam-build.json");
    let entries = manifest["files"].as_array().unwrap();
    assert_eq!(
        entries.len(),
        actual.len(),
        "Frontend inventory changed; rebuild frontend"
    );
    let mut output = String::from("pub static ASSETS: &[Asset] = &[\n");
    let mut seen = std::collections::BTreeSet::new();
    for entry in entries {
        let name = entry["path"].as_str().unwrap();
        assert!(
            !name.contains('\\')
                && !name.starts_with('/')
                && name
                    .split('/')
                    .all(|s| !s.is_empty() && s != "." && s != ".."),
            "Invalid build asset path"
        );
        assert!(seen.insert(name));
        let path = dist.join(name);
        assert!(actual.contains(&path), "Missing frontend asset");
        let digest = hash(&fs::read(&path).unwrap());
        assert_eq!(
            entry["sha256"], digest,
            "Frontend bytes changed; rebuild frontend"
        );
        let immutable = (name.starts_with("assets/") || name.starts_with("app/assets/") || name.starts_with("site-assets/")) && !root.join("public").join(name).exists();
        output.push_str(&format!(
            "Asset {{ path: {:?}, bytes: include_bytes!({:?}), etag: {:?}, immutable: {} }},\n",
            format!("/{name}"),
            path.to_str().unwrap(),
            format!("\"{digest}\""),
            immutable
        ));
    }
    assert!(seen.contains("index.html"), "Missing frontend entrypoint");
    output.push_str("];\n");
    fs::write(
        PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("frontend_assets.rs"),
        output,
    )
    .unwrap();
}

pub fn verify_source_hash(manifest: &serde_json::Value, root: &Path) {
    let source = source_hash(root);
    assert_eq!(
        manifest["sourceHash"].as_str(),
        Some(source.as_str()),
        "Stale frontend build; run npm run build:embedded in frontend"
    );
}

// Keep stable input names and byte ordering in parity with build-inputs.mjs.
pub fn source_hash(root: &Path) -> String {
    let mut inputs = Vec::new();
    for name in [
        "src",
        "public",
        "scripts",
        "package.json",
        "package-lock.json",
        "index.html",
        "vite.config.ts",
        "tsconfig.json",
        "tsconfig.app.json",
        "tsconfig.node.json",
    ] {
        println!("cargo:rerun-if-changed=frontend/{name}");
        files(&root.join(name), &mut inputs);
    }
    let mut inputs: Vec<_> = inputs
        .into_iter()
        .map(|path| {
            (
                path.strip_prefix(&root)
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .replace('\\', "/"),
                path,
            )
        })
        .collect();
    for name in ["docs/team-role-icons.json", "docs/mcp-catalog.json", "Cargo.toml"] {
        let path = root.parent().unwrap().join(name);
        assert_eq!(fs::canonicalize(&path).unwrap(), fs::canonicalize(root).unwrap().parent().unwrap().join(name), "external embedded UI inputs cannot traverse symlinks");
        assert!(!fs::symlink_metadata(&path).unwrap().file_type().is_symlink());
        inputs.push((format!("../{name}"), path));
        println!("cargo:rerun-if-changed={name}");
    }
    inputs.sort_by(|a, b| a.0.cmp(&b.0));
    let mut source = Sha256::new();
    for (name, path) in inputs {
        source.update(name.as_bytes());
        source.update([0]);
        source.update(fs::read(path).unwrap());
        source.update([0]);
    }
    let source: String = source
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    source
}

pub fn verify_site_sources(manifest: &serde_json::Value, root: &Path) {
    let Some(entries) = manifest["siteSources"].as_array() else { return; };
    let mut paths = Vec::new();
    site_files(&root.join("site"), &mut paths);
    paths.push(root.join("docs/mcp-catalog.json"));
    paths.push(root.join("Cargo.toml"));
    assert_eq!(paths.len(), entries.len(), "Site sources changed; rebuild the UI");
    for entry in entries {
        let name = entry["path"].as_str().unwrap();
        assert!((name.starts_with("site/") || name == "docs/mcp-catalog.json" || name == "Cargo.toml") && !name.contains('\\') && name.split('/').all(|p| !p.is_empty() && p != "." && p != ".."));
        let path = root.join(name);
        assert!(paths.contains(&path), "Unexpected site source");
        println!("cargo:rerun-if-changed={}",path.display());
        assert_eq!(entry["sha256"], hash(&fs::read(path).unwrap()), "Stale site build");
    }
}
fn site_files(path: &Path, out: &mut Vec<PathBuf>) {
    assert!(!fs::symlink_metadata(path).unwrap().file_type().is_symlink(), "Site inputs cannot be symlinks");
    if path.is_dir() {
        for entry in fs::read_dir(path).unwrap() {
            let path = entry.unwrap().path();
            if ["node_modules","dist",".vite",".git"].iter().any(|n| path.file_name().unwrap() == *n) { continue; }
            site_files(&path,out);
        }
    } else { out.push(path.into()); }
}
