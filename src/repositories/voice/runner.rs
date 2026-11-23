use super::*;

struct PendingContext {
    sent: Instant,
    reply: oneshot::Sender<Result<()>>,
}
#[derive(Default)]
struct Pending {
    calls: HashMap<String, Value>,
    completed: HashMap<String, String>,
    contexts: HashMap<u64, PendingContext>,
}

pub(super) async fn run(
    wire: &mut Wire,
    commands: &mut mpsc::Receiver<Command>,
    events: &Arc<Mutex<Events>>,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    let mut pending = Pending::default();
    loop {
        tokio::select! {
            _ = interval.tick() => {
                let expired = events.lock().await.last_seen.is_none_or(|seen| seen.elapsed() > Duration::from_secs(30));
                let stalled = pending.contexts.values().any(|context| context.sent.elapsed() > Duration::from_secs(10));
                if expired || stalled { break; }
            }
            command = commands.recv() => {
                let Some(command) = command else { break; };
                if !handle_command(wire, &mut pending, command).await { break; }
            }
            message = wire.line() => {
                let Ok(message) = message else {
                    events.lock().await.push("error", None, Some("Local Codex voice connection ended".into()), None);
                    break;
                };
                if !handle_message(wire, &mut pending, events, message).await { break; }
            }
        }
    }
}

async fn handle_command(wire: &mut Wire, pending: &mut Pending, command: Command) -> bool {
    match command {
        Command::Stop => return false,
        Command::Context(content, reply) => match wire.append(content).await {
            Ok(id) => {
                pending.contexts.insert(
                    id,
                    PendingContext {
                        sent: Instant::now(),
                        reply,
                    },
                );
            }
            Err(error) => {
                let _ = reply.send(Err(error));
                return false;
            }
        },
        Command::Result(call, content, reply) => {
            let result = acknowledge(wire, pending, call, content).await;
            let disconnected = result
                .as_ref()
                .is_err_and(|error| error.code == "voice_unavailable");
            let _ = reply.send(result);
            if disconnected {
                return false;
            }
        }
    }
    true
}

async fn acknowledge(
    wire: &mut Wire,
    pending: &mut Pending,
    call: String,
    content: String,
) -> Result<()> {
    if let Some(previous) = pending.completed.get(&call) {
        return if previous == &content {
            Ok(())
        } else {
            Err(Failure::invalid(
                "Tool result already acknowledged with different content",
            ))
        };
    }
    let request_id = pending.calls.remove(&call).ok_or_else(Failure::missing)?;
    wire.reply(
        request_id,
        json!({"contentItems":[{"type":"inputText","text":content}],"success":true}),
    )
    .await?;
    pending.completed.insert(call, content);
    Ok(())
}

async fn handle_message(
    wire: &mut Wire,
    pending: &mut Pending,
    events: &Arc<Mutex<Events>>,
    message: Value,
) -> bool {
    let method = message["method"].as_str().unwrap_or("");
    let params = &message["params"];
    if method.is_empty() {
        if let Some(id) = message["id"].as_u64() {
            if let Some(context) = pending.contexts.remove(&id) {
                let result = if message["error"].is_null() {
                    Ok(())
                } else {
                    Err(Failure::new(
                        "voice_unavailable",
                        "Codex rejected voice context",
                    ))
                };
                let _ = context.reply.send(result);
            }
        }
        return true;
    }
    if message.get("id").is_some() {
        if method != "item/tool/call"
            || params["tool"] != "execute_codex"
            || params["threadId"] != wire.thread
        {
            return wire.reject(message["id"].clone()).await.is_ok();
        }
        let call = params["callId"].as_str().unwrap_or("").to_owned();
        let content = params["arguments"]["content"]
            .as_str()
            .unwrap_or("")
            .to_owned();
        if call.is_empty() || validate_text(&content, 65536).is_err() {
            return wire
                .reply(
                    message["id"].clone(),
                    json!({"success":false,"contentItems":[]}),
                )
                .await
                .is_ok();
        }
        if pending.calls.contains_key(&call)
            || pending.completed.contains_key(&call)
            || pending.completed.len() + pending.calls.len() >= 256
        {
            return false;
        }
        pending.calls.insert(call.clone(), message["id"].clone());
        return events
            .lock()
            .await
            .push("execute_codex", Some(call), Some(content), None);
    }
    match method {
        "thread/realtime/transcript/done" => events.lock().await.push(
            "transcript",
            None,
            params["text"].as_str().map(str::to_owned),
            params["role"].as_str().map(str::to_owned),
        ),
        "thread/realtime/error" => {
            events.lock().await.push(
                "error",
                None,
                Some("Local Codex could not continue the voice session".into()),
                None,
            );
            false
        }
        "thread/realtime/closed" => {
            events.lock().await.push("closed", None, None, None);
            false
        }
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn relays_only_owned_dynamic_calls_and_acknowledges_once() {
        let mut wire = super::super::wire::fixture();
        let mut pending = Pending::default();
        let events = Arc::new(Mutex::new(Events::default()));
        let event = json!({"id":900,"method":"item/tool/call","params":{"threadId":"owned-voice-thread","tool":"execute_codex","callId":"call-one","arguments":{"content":"Implement this change"}}});
        assert!(handle_message(&mut wire, &mut pending, &events, event).await);
        assert_eq!(events.lock().await.items[0].r#type, "execute_codex");
        acknowledge(&mut wire, &mut pending, "call-one".into(), "queued".into())
            .await
            .unwrap();
        acknowledge(&mut wire, &mut pending, "call-one".into(), "queued".into())
            .await
            .unwrap();
        assert!(
            acknowledge(
                &mut wire,
                &mut pending,
                "call-one".into(),
                "different".into()
            )
            .await
            .is_err()
        );
        let unexpected = json!({"id":901,"method":"item/commandExecution/requestApproval","params":{"threadId":"owned-voice-thread"}});
        assert!(handle_message(&mut wire, &mut pending, &events, unexpected).await);
        let replies = wire.request("test/replies", json!({})).await.unwrap();
        assert_eq!(replies["replies"].as_array().unwrap().len(), 2);
        assert_eq!(replies["replies"][0]["result"]["success"], true);
        assert!(replies["replies"][1]["error"].is_object());
        wire.stop().await.unwrap();
    }
    #[tokio::test]
    async fn rejects_context_when_provider_returns_error() {
        let mut wire = super::super::wire::fixture();
        let mut pending = Pending::default();
        let events = Arc::new(Mutex::new(Events::default()));
        let (tx, rx) = oneshot::channel();
        pending.contexts.insert(
            77,
            PendingContext {
                sent: Instant::now(),
                reply: tx,
            },
        );
        assert!(
            handle_message(
                &mut wire,
                &mut pending,
                &events,
                json!({"id":77,"error":{"code":-1}})
            )
            .await
        );
        assert!(rx.await.unwrap().is_err());
        wire.stop().await.unwrap();
    }
}
