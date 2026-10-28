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
    println!("cargo:rerun-if-changed={}", dist.display());
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
    let manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(dist.join(".beeteam-build.json")).expect(
            "Missing embedded frontend build; run npm ci and npm run build:embedded in frontend",
        ))
        .unwrap();
    assert_eq!(
        manifest["sourceHash"].as_str(),
        Some(source.as_str()),
        "Stale frontend build; run npm run build:embedded in frontend"
    );
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
        let immutable = name.starts_with("assets/") && !root.join("public").join(name).exists();
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
