use super::*;
use crate::{
    dto::backend::*,
    repositories::{contracts::UnitOfWork, records::Record},
};
use chrono::Utc;
use serde_json::json;

pub(super) async fn run(unit: &mut UnitOfWork, c: &Command) -> Result<Outcome> {
    let is_image = c.operation.contains("AgentImage");
    let id = c.id(if is_image { "agentId" } else { "taskId" })?;
    let table = if is_image { "agents" } else { "tasks" };
    unit.records.get(table, id)?;
    let download = c.operation.starts_with("download");
    if !download {
        check_version(unit.records.get(table, id)?, c.expected_version)?;
        if is_image {
            active(&unit.records, "agents", id)?;
        } else {
            hierarchy::writable(&unit.records, id, false)?;
        }
    }
    if download {
        let file = if is_image {
            unit.records
                .list("images")
                .into_iter()
                .find(|r| r.reference("agentId") == Some(id))
                .cloned()
                .ok_or_else(Failure::missing)?
        } else {
            let file = unit.records.get("attachments", c.id("attachmentId")?)?;
            if file.reference("taskId") != Some(id) {
                return Err(Failure::missing());
            }
            file.clone()
        };
        let bytes = unit.file(body_id(&file.data, "contentId")?).await?;
        let mut result = Outcome::data(file.value());
        result.file = Some(UploadOutput {
            name: file.data["originalName"].as_str().unwrap_or("image").into(),
            media_type: file.data["mediaType"]
                .as_str()
                .unwrap_or("application/octet-stream")
                .into(),
            bytes,
        });
        return Ok(result);
    }
    if c.operation.starts_with("remove") {
        if is_image {
            if unit.records.get("agents", id)?.data["image"].is_null() {
                return Err(Failure::missing());
            }
            ra::retire_image(unit, id).await?;
            unit.records.get_mut("agents", id)?.data["image"] = serde_json::Value::Null;
        } else {
            let fid = c.id("attachmentId")?;
            let file = unit.records.get("attachments", fid)?.clone();
            if file.reference("taskId") != Some(id) {
                return Err(Failure::missing());
            }
            unit.records.get_mut("attachments", fid)?.deleted_at = Some(Utc::now());
            unit.delete_file(body_id(&file.data, "contentId")?).await?;
            event(
                unit,
                c,
                id,
                "attachment.removed",
                json!({"attachmentId":fid}),
            )
            .await?;
        }
        unit.records.get_mut(table, id)?.touch();
        return outcome(&unit.records, table, id, false);
    }
    let upload = c
        .upload
        .as_ref()
        .ok_or_else(|| Failure::invalid("Exactly one file is required"))?;
    let max = if is_image {
        5 * 1024 * 1024
    } else {
        20 * 1024 * 1024
    };
    if upload.bytes.len() > max {
        return Err(Failure::new("payload_too_large", "File exceeds limit"));
    }
    let mut media_type = upload.media_type.clone();
    if is_image {
        let format = image::guess_format(&upload.bytes)
            .map_err(|_| Failure::new("unsupported_media", "Expected PNG, JPEG or WebP"))?;
        media_type = match format {
            image::ImageFormat::Png => "image/png",
            image::ImageFormat::Jpeg => "image/jpeg",
            image::ImageFormat::WebP => "image/webp",
            _ => {
                return Err(Failure::new(
                    "unsupported_media",
                    "Expected PNG, JPEG or WebP",
                ))
            }
        }
        .into();
        let mut reader =
            image::ImageReader::with_format(std::io::Cursor::new(&upload.bytes), format);
        let mut limits = image::Limits::default();
        limits.max_alloc = Some(128 * 1024 * 1024);
        reader.limits(limits);
        reader.decode().map_err(|_| {
            Failure::new(
                "unsupported_media",
                "Image content cannot be decoded within limits",
            )
        })?;
        ra::retire_image(unit, id).await?;
    }
    let content = unit.put_file(&upload.bytes).await?;
    let file = Record::new(
        if is_image { "images" } else { "attachments" },
        json!({if is_image{"agentId"}else{"taskId"}:id,"contentId":content,"originalName":upload.name,"mediaType":media_type,"sizeBytes":upload.bytes.len(),"description":c.body.get("description").cloned().unwrap_or(json!("")),"actorId":c.actor()?.id,"actorKind":c.actor()?.kind}),
    );
    let fid = unit.records.insert(file);
    if is_image {
        unit.records.get_mut("agents", id)?.data["image"] = json!({"kind":"upload","imageId":fid,"mediaType":media_type,"sizeBytes":upload.bytes.len(),"contentPath":format!("/api/v2/agents/{id}/image/content"),"deletedAt":null});
    } else {
        event(unit, c, id, "attachment.added", json!({"attachmentId":fid})).await?;
    }
    unit.records.get_mut(table, id)?.touch();
    let mut result = outcome(
        &unit.records,
        if is_image { "agents" } else { "attachments" },
        if is_image { id } else { fid },
        true,
    )?;
    result.version = Some(unit.records.get(table, id)?.version);
    Ok(result)
}
