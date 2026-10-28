use beeteam::repositories::transfer::archive::{ArchiveStore, Limits};
use serde_json::json;
#[test]
fn portable_archive_preserves_json_and_blob_and_rejects_tampering() {
    let dir = tempfile::tempdir().unwrap();
    let store = ArchiveStore::new(dir.path().to_owned(), Limits::default()).unwrap();
    let id = uuid::Uuid::now_v7();
    store.create_stage(id).unwrap();
    let value = json!({"null":null,"empty":"","number":9223372036854775807i64,"bool":true,"markdown":"# Olá\n```rs\nlet x=1;\n```"});
    store.append(id, "records/agents.jsonl", &value).unwrap();
    store
        .write_blob(id, uuid::Uuid::now_v7(), b"binary\0bytes")
        .unwrap();
    let manifest = store.seal(id, "sqlite", 0).unwrap();
    let validated = store.validate_archive(id).unwrap();
    assert_eq!(manifest.entries, validated.entries);
    assert_eq!(store.rows(id, "agents").unwrap()[0], value);
}
#[test]
fn duplicate_json_keys_are_rejected_recursively() {
    assert!(beeteam::repositories::transfer::json::parse(br#"{"a":{"x":1,"x":2}}"#).is_err());
}

fn bad_zip(name: &str, content: &[u8], limits: Limits) -> bool {
    use std::io::Write;
    let dir = tempfile::tempdir().unwrap();
    let store = ArchiveStore::new(dir.path().into(), limits).unwrap();
    let id = uuid::Uuid::now_v7();
    let mut zip = zip::ZipWriter::new(store.upload_file(id).unwrap());
    zip.start_file(name, zip::write::SimpleFileOptions::default())
        .unwrap();
    zip.write_all(content).unwrap();
    zip.finish().unwrap();
    store.validate_archive(id).is_err()
}
#[test]
fn rejects_traversal_unknown_entries_and_expansion() {
    for name in [
        "../escape",
        "/absolute",
        "C:/absolute",
        "records/unknown.jsonl",
        "blobs/not-a-uuid.bin",
    ] {
        assert!(bad_zip(name, b"x", Limits::default()), "{name}");
    }
    let mut limits = Limits::default();
    limits.expanded = 8;
    assert!(bad_zip("manifest.json", &[b'a'; 20], limits));
    let mut limits = Limits::default();
    limits.entries = 0;
    assert!(bad_zip("manifest.json", b"{}", limits));
}
#[test]
fn rejects_hash_corruption_and_truncation() {
    let dir = tempfile::tempdir().unwrap();
    let store = ArchiveStore::new(dir.path().into(), Limits::default()).unwrap();
    let id = uuid::Uuid::now_v7();
    store.create_stage(id).unwrap();
    store
        .append(id, "records/agents.jsonl", &json!({"text":"UNIQUE_DATA"}))
        .unwrap();
    store.seal(id, "sqlite", 0).unwrap();
    let path = store.archive_path(id);
    let mut bytes = std::fs::read(&path).unwrap();
    let offset = bytes.windows(11).position(|w| w == b"UNIQUE_DATA").unwrap();
    bytes[offset] = b'X';
    std::fs::write(&path, &bytes).unwrap();
    assert!(store.validate_archive(id).is_err());
    bytes.truncate(bytes.len() / 2);
    std::fs::write(path, bytes).unwrap();
    assert!(store.validate_archive(id).is_err());
}

#[test]
fn rejects_symlink_duplicate_entry_unknown_version_and_oversized_line() {
    use std::io::{Read, Write};
    let dir = tempfile::tempdir().unwrap();
    let store = ArchiveStore::new(dir.path().into(), Limits::default()).unwrap();
    let id = uuid::Uuid::now_v7();
    let mut zip = zip::ZipWriter::new(store.upload_file(id).unwrap());
    zip.add_symlink(
        format!("blobs/{}.bin", uuid::Uuid::now_v7()),
        "../../outside",
        zip::write::SimpleFileOptions::default(),
    )
    .unwrap();
    zip.finish().unwrap();
    assert!(store.validate_archive(id).is_err());
    let id = uuid::Uuid::now_v7();
    store.create_stage(id).unwrap();
    store.seal(id, "sqlite", 0).unwrap();
    let path = store.archive_path(id);
    let mut bytes = std::fs::read(&path).unwrap();
    let old = b"records/boards.jsonl";
    let new = b"records/agents.jsonl";
    let matches: Vec<_> = bytes
        .windows(old.len())
        .enumerate()
        .filter_map(|(i, w)| (w == old).then_some(i))
        .collect();
    for i in matches {
        bytes[i..i + old.len()].copy_from_slice(new);
    }
    std::fs::write(&path, bytes).unwrap();
    assert!(store.validate_archive(id).is_err());
    let id = uuid::Uuid::now_v7();
    store.create_stage(id).unwrap();
    store.seal(id, "sqlite", 0).unwrap();
    let path = store.archive_path(id);
    let mut original = zip::ZipArchive::new(std::fs::File::open(&path).unwrap()).unwrap();
    let mut entries = Vec::new();
    for i in 0..original.len() {
        let mut f = original.by_index(i).unwrap();
        let name = f.name().to_owned();
        let mut bytes = Vec::new();
        f.read_to_end(&mut bytes).unwrap();
        if name == "manifest.json" {
            let mut value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            value["formatVersion"] = json!(999);
            bytes = serde_json::to_vec(&value).unwrap();
        }
        entries.push((name, bytes));
    }
    drop(original);
    let mut changed = zip::ZipWriter::new(std::fs::File::create(&path).unwrap());
    for (name, bytes) in entries {
        changed
            .start_file(name, zip::write::SimpleFileOptions::default())
            .unwrap();
        changed.write_all(&bytes).unwrap();
    }
    changed.finish().unwrap();
    assert!(store.validate_archive(id).is_err());
    let id = uuid::Uuid::now_v7();
    store.create_stage(id).unwrap();
    store
        .append(id, "records/agents.jsonl", &json!({"long":"x".repeat(200)}))
        .unwrap();
    store.seal(id, "sqlite", 0).unwrap();
    let strict = ArchiveStore::new(
        dir.path().into(),
        Limits {
            line: 64,
            ..Limits::default()
        },
    )
    .unwrap();
    assert!(strict.validate_archive(id).is_err());
}
#[test]
fn cancelled_validation_stops_before_inspecting_records() {
    let dir = tempfile::tempdir().unwrap();
    let store = ArchiveStore::new(dir.path().into(), Limits::default()).unwrap();
    let id = uuid::Uuid::now_v7();
    store.create_stage(id).unwrap();
    let manifest = store.seal(id, "sqlite", 0).unwrap();
    store.validate_archive(id).unwrap();
    store.cancel(id).unwrap();
    assert!(store
        .validate_archive(id)
        .unwrap_err()
        .to_string()
        .contains("cancel"));
    // A populated group reaches the same cancellation guard in domain validation.
    store
        .append(
            id,
            "records/agents.jsonl",
            &json!({"id":uuid::Uuid::now_v7()}),
        )
        .unwrap();
    assert!(
        beeteam::services::data_transfer::validation::inspect(&store, id, &manifest, "sqlite")
            .unwrap_err()
            .to_string()
            .contains("cancel")
    );
}
