use super::*;
use crate::{
    dto::managed_file_citations::{project, Citation},
    repositories::{contracts::UnitOfWork, integrated_provider::GeneratedFile},
};

const MAX_FILES: usize = 16;
const MAX_TOTAL_BYTES: usize = 40 * 1024 * 1024;

pub(super) struct Captured {
    message: Uuid,
    source: String,
    files: Vec<(Citation, Option<GeneratedFile>)>,
}
impl Captured {
    pub(super) fn bind_message(&mut self, message: Uuid) {
        self.message = message;
    }
}

pub(super) fn project_message(message: &Record, value: &mut Value) {
    let (content, citations) = if message.data["role"] == "agent" {
        project(message.data["content"].as_str().unwrap_or(""))
    } else {
        (
            message.data["content"].as_str().unwrap_or("").to_owned(),
            vec![],
        )
    };
    value["content"] = json!(content);
    value["files"] = json!(citations.iter().map(|citation| {
        let stored = message.data["files"].as_array().and_then(|files| {
            files.iter().find(|f| f["key"] == citation.key)
        });
        match stored {
            Some(file) => json!({
                "index": citation.index, "id": file["id"], "name": file["name"],
                "mediaType": file["mediaType"], "sizeBytes": file["sizeBytes"], "status": "available"
            }),
            None => json!({"index": citation.index, "name": citation.name, "status": "unavailable"}),
        }
    }).collect::<Vec<_>>());
}

async fn capture(
    provider: Arc<dyn IntegratedProvider>,
    root: String,
    message: Uuid,
    source: String,
) -> Result<Captured> {
    let (_, citations) = project(&source);
    let files = tokio::task::spawn_blocking(move || {
        let mut total = 0;
        citations
            .into_iter()
            .enumerate()
            .map(|(index, citation)| {
                let file = if index < MAX_FILES {
                    citation.path.as_deref().and_then(|path| {
                        match provider.read_output(&root, path) {
                            Ok(file) if total + file.bytes.len() <= MAX_TOTAL_BYTES => {
                                total += file.bytes.len();
                                Some(file)
                            }
                            Ok(_) => {
                                tracing::warn!("Generated output exceeds aggregate limit");
                                None
                            }
                            Err(error) => {
                                tracing::warn!(code=%error.code, "Generated output unavailable");
                                None
                            }
                        }
                    })
                } else {
                    tracing::warn!("Generated output exceeds file count limit");
                    None
                };
                (citation, file)
            })
            .collect()
    })
    .await
    .map_err(|_| Failure::new("internal_error", "File capture task failed"))?;
    Ok(Captured {
        message,
        source,
        files,
    })
}

pub(super) async fn save(u: &mut UnitOfWork, captured: Captured) -> Result<()> {
    let message = u.records.get("managed_messages", captured.message)?;
    if message.data["content"].as_str() != Some(&captured.source) {
        return Err(Failure::new(
            "version_conflict",
            "Message changed during file capture",
        ));
    }
    let mut stored = message.data["files"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let mut changed = false;
    for (citation, file) in captured.files {
        if stored.iter().any(|f| f["key"] == citation.key) {
            continue;
        }
        if let Some(file) = file {
            let size = file.bytes.len();
            let id = u.put_file(&file.bytes).await?;
            stored.push(json!({"key":citation.key,"id":id,"name":file.name,"mediaType":file.media_type,"sizeBytes":size}));
            changed = true;
        }
    }
    if changed {
        let message = u.records.get_mut("managed_messages", captured.message)?;
        message.data["files"] = json!(stored);
        message.touch();
    }
    Ok(())
}

pub struct MessageFile {
    pub name: String,
    pub media_type: String,
    pub bytes: Vec<u8>,
}

impl ManagedAgentService {
    pub(super) async fn capture_text_outputs(
        &self,
        root: &str,
        source: String,
    ) -> Result<Option<Captured>> {
        if project(&source).1.is_empty() {
            return Ok(None);
        }
        let provider = self
            .provider
            .clone()
            .ok_or_else(|| Failure::new("provider_unavailable", "Provider unavailable"))?;
        Ok(Some(
            capture(provider, root.to_owned(), Uuid::nil(), source).await?,
        ))
    }

    pub(super) async fn capture_request_outputs(
        &self,
        request: Uuid,
        root: &str,
    ) -> Result<Option<Captured>> {
        let mut c = command("snapshot");
        c.params.insert("requestId".into(), request.to_string());
        let u = self.store.read(&c).await?;
        let message = u
            .records
            .list("managed_messages")
            .into_iter()
            .find(|m| m.reference("requestId") == Some(request) && m.data["role"] == "agent")
            .map(|m| (m.id, m.data["content"].as_str().unwrap_or("").to_owned()));
        u.rollback().await?;
        let Some((id, source)) = message else {
            return Ok(None);
        };
        if project(&source).1.is_empty() {
            return Ok(None);
        }
        let provider = self
            .provider
            .clone()
            .ok_or_else(|| Failure::new("provider_unavailable", "Provider unavailable"))?;
        Ok(Some(capture(provider, root.to_owned(), id, source).await?))
    }

    pub async fn recover_files(&self, c: Command) -> Result<Value> {
        self.recover().await?;
        let conversation = c.id("conversationId")?;
        let message = c.id("messageId")?;
        let key = c
            .idempotency_key
            .ok_or_else(|| Failure::new("version_required", "Idempotency-Key required"))?;
        let operation = format!("managed:recover-files:{conversation}:{message}");
        let hash = serde_json::to_string(&json!({"version":c.expected_version})).unwrap();
        let mut u = self.store.begin().await?;
        if let Some(out) = u.replay("managed-local", &operation, key, &hash).await? {
            u.rollback().await?;
            return Ok(out.data);
        }
        let row = u.records.get("managed_messages", message)?;
        if row.reference("conversationId") != Some(conversation) || row.data["role"] != "agent" {
            return Err(Failure::missing());
        }
        check_version(row, &c)?;
        let source = row.data["content"].as_str().unwrap_or("").to_owned();
        let conv = u.records.get("managed_conversations", conversation)?;
        if conv.data["installationId"] != self.installation {
            return Err(Failure::new(
                "provider_unavailable",
                "Recover files on the original installation",
            ));
        }
        let agent = conv.reference("agentId").ok_or_else(Failure::missing)?;
        u.rollback().await?;
        let provider = self
            .provider
            .clone()
            .ok_or_else(|| Failure::new("provider_unavailable", "Provider unavailable"))?;
        let root = provider
            .default_workspace(agent)
            .map_err(|e| Failure::new(e.code, e.message))?;
        let captured = capture(provider, root, message, source).await?;
        let mut u = self.store.begin().await?;
        if let Some(out) = u.replay("managed-local", &operation, key, &hash).await? {
            u.rollback().await?;
            return Ok(out.data);
        }
        let row = u.records.get("managed_messages", message)?;
        if row.reference("conversationId") != Some(conversation) || row.data["role"] != "agent" {
            return Err(Failure::missing());
        }
        check_version(row, &c)?;
        let conv = u.records.get("managed_conversations", conversation)?;
        if conv.data["installationId"] != self.installation
            || conv.reference("agentId") != Some(agent)
        {
            return Err(Failure::new(
                "provider_unavailable",
                "Conversation installation changed",
            ));
        }
        save(&mut u, captured).await?;
        let result = public(u.records.get("managed_messages", message)?);
        u.save_replay(
            "managed-local",
            &operation,
            key,
            &hash,
            &Outcome::data(result.clone()),
        )
        .await?;
        u.commit().await?;
        Ok(result)
    }

    pub async fn message_file(
        &self,
        conversation: Uuid,
        message: Uuid,
        file: Uuid,
    ) -> Result<MessageFile> {
        let mut c = command("message-image");
        c.params
            .insert("conversationId".into(), conversation.to_string());
        c.params.insert("messageId".into(), message.to_string());
        let mut u = self.store.read(&c).await?;
        let row = u.records.get("managed_messages", message)?;
        if row.reference("conversationId") != Some(conversation) {
            return Err(Failure::missing());
        }
        let (_, citations) = project(row.data["content"].as_str().unwrap_or(""));
        let stored = row.data["files"]
            .as_array()
            .and_then(|files| {
                files
                    .iter()
                    .find(|f| f["id"] == json!(file) && citations.iter().any(|c| f["key"] == c.key))
            })
            .ok_or_else(Failure::missing)?;
        let name = stored["name"]
            .as_str()
            .ok_or_else(Failure::missing)?
            .to_owned();
        let media_type = stored["mediaType"]
            .as_str()
            .filter(|t| matches!(*t, "application/pdf" | "application/octet-stream"))
            .ok_or_else(Failure::missing)?
            .to_owned();
        let bytes = u.file(file).await?;
        u.rollback().await?;
        Ok(MessageFile {
            name,
            media_type,
            bytes,
        })
    }
}
