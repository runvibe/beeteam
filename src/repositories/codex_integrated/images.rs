//! Extracts generated images from Codex App Server items without trusting arbitrary paths.
use super::super::integrated_provider::IntegratedEvent;
use base64::Engine;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub(super) const MAX_IMAGE_BYTES: usize = 20 * 1024 * 1024;

/// Directory where Codex stores generated images (`$CODEX_HOME/generated_images`).
pub(super) fn generated_images_root() -> Option<PathBuf> {
    let home = std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".codex")))?;
    Some(home.join("generated_images"))
}

pub(super) fn media_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.len() > 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

fn inline(result: &str) -> Option<Vec<u8>> {
    let data = result
        .strip_prefix("data:")
        .and_then(|rest| rest.split_once(";base64,").map(|(_, d)| d))
        .unwrap_or(result);
    if data.len() > MAX_IMAGE_BYTES / 3 * 4 + 4 {
        return None;
    }
    base64::engine::general_purpose::STANDARD
        .decode(data.trim())
        .ok()
}

fn saved(path: &str, root: &Path) -> Option<Vec<u8>> {
    let root = root.canonicalize().ok()?;
    let file = Path::new(path).canonicalize().ok()?;
    if !file.starts_with(&root) || !file.is_file() {
        return None;
    }
    if file.metadata().ok()?.len() as usize > MAX_IMAGE_BYTES {
        return None;
    }
    std::fs::read(file).ok()
}

/// Returns an image event for a completed `imageGeneration` item, when its bytes are available.
pub(super) fn generated_image(item: &Value, root: Option<&Path>) -> Option<IntegratedEvent> {
    if item["type"] != "imageGeneration" || item["status"].as_str() == Some("failed") {
        return None;
    }
    let bytes = item["result"]
        .as_str()
        .filter(|r| !r.is_empty())
        .and_then(inline)
        .or_else(|| saved(item["savedPath"].as_str()?, root?))?;
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return None;
    }
    let media_type = media_type(&bytes)?;
    Some(IntegratedEvent::Image {
        item_id: item["id"].as_str().unwrap_or_default().to_owned(),
        media_type: media_type.to_owned(),
        bytes,
        revised_prompt: item["revisedPrompt"]
            .as_str()
            .map(|p| p.chars().take(2048).collect()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    const PNG: &[u8] = b"\x89PNG\r\n\x1a\nrest";

    fn bytes(e: IntegratedEvent) -> (String, Vec<u8>, Option<String>) {
        match e {
            IntegratedEvent::Image {
                media_type,
                bytes,
                revised_prompt,
                ..
            } => (media_type, bytes, revised_prompt),
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn decodes_inline_result() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(PNG);
        let item = json!({"id":"ig","type":"imageGeneration","status":"completed","result":encoded,"revisedPrompt":"bees"});
        let (media, data, prompt) = bytes(generated_image(&item, None).unwrap());
        assert_eq!(media, "image/png");
        assert_eq!(data, PNG);
        assert_eq!(prompt.as_deref(), Some("bees"));
    }

    #[test]
    fn reads_saved_path_only_inside_generated_images() {
        let dir = std::env::temp_dir().join(format!("bee-images-{}", uuid::Uuid::now_v7()));
        let root = dir.join("generated_images");
        std::fs::create_dir_all(root.join("thread")).unwrap();
        let inside = root.join("thread/a.png");
        let outside = dir.join("b.png");
        std::fs::write(&inside, PNG).unwrap();
        std::fs::write(&outside, PNG).unwrap();
        let item = |p: &Path| json!({"id":"ig","type":"imageGeneration","status":"completed","savedPath":p});
        assert!(generated_image(&item(&inside), Some(&root)).is_some());
        assert!(generated_image(&item(&outside), Some(&root)).is_none());
        assert!(generated_image(&item(&root.join("../b.png")), Some(&root)).is_none());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rejects_unknown_formats_and_other_items() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"<svg/>");
        let item =
            json!({"id":"ig","type":"imageGeneration","status":"completed","result":encoded});
        assert!(generated_image(&item, None).is_none());
        let view = json!({"id":"iv","type":"imageView","path":"/etc/passwd"});
        assert!(generated_image(&view, None).is_none());
    }
}
