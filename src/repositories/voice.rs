//! Owned local Codex processes for browser voice calls. No credentials leave the local CLI.
mod runner;
mod wire;
use crate::{
    dto::{
        backend::{Failure, Result},
        voice::*,
    },
    repositories::contracts::{RepositoryFuture, VoiceProvider},
};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, Semaphore, mpsc, oneshot};
use uuid::Uuid;
use wire::Wire;
const MAX_EVENTS: usize = 256;
#[derive(Clone)]
struct Session {
    commands: mpsc::Sender<Command>,
    events: Arc<Mutex<Events>>,
}
#[derive(Default)]
struct Events {
    items: VecDeque<VoiceEvent>,
    cursor: u64,
    last_seen: Option<Instant>,
}
impl Events {
    fn push(
        &mut self,
        kind: &str,
        call: Option<String>,
        content: Option<String>,
        role: Option<String>,
    ) -> bool {
        if self.items.len() >= MAX_EVENTS {
            return false;
        }
        self.cursor += 1;
        self.items.push_back(VoiceEvent {
            cursor: self.cursor,
            r#type: kind.into(),
            call_id: call,
            content,
            role,
        });
        true
    }
}
enum Command {
    Result(String, String, oneshot::Sender<Result<()>>),
    Context(String, oneshot::Sender<Result<()>>),
    Stop,
}
pub struct CodexVoiceProvider {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    slots: Arc<Semaphore>,
}
impl Default for CodexVoiceProvider {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            slots: Arc::new(Semaphore::new(4)),
        }
    }
}
impl CodexVoiceProvider {
    async fn session(&self, id: &str) -> Result<Session> {
        self.sessions
            .lock()
            .await
            .get(id)
            .cloned()
            .ok_or_else(Failure::missing)
    }
    async fn send(&self, id: String, content: String, call: Option<String>) -> Result<()> {
        let session = self.session(&id).await?;
        let (tx, rx) = oneshot::channel();
        let command = match call {
            Some(call) => Command::Result(call, content, tx),
            None => Command::Context(content, tx),
        };
        session
            .commands
            .send(command)
            .await
            .map_err(|_| unavailable())?;
        tokio::time::timeout(Duration::from_secs(10), rx)
            .await
            .map_err(|_| unavailable())?
            .map_err(|_| unavailable())?
    }
}
impl VoiceProvider for CodexVoiceProvider {
    fn start(&self, sdp: String, instructions: String) -> RepositoryFuture<'_, VoiceSession> {
        Box::pin(async move {
            let permit = self
                .slots
                .clone()
                .try_acquire_owned()
                .map_err(|_| Failure::new("voice_busy", "Too many active voice sessions"))?;
            let (mut wire, answer) =
                tokio::time::timeout(Duration::from_secs(45), Wire::start(sdp, instructions))
                    .await
                    .map_err(|_| {
                        Failure::new("voice_timeout", "Local Codex voice startup timed out")
                    })??;
            let id = Uuid::new_v4().to_string();
            let (tx, mut rx) = mpsc::channel(16);
            let events = Arc::new(Mutex::new(Events {
                last_seen: Some(Instant::now()),
                ..Default::default()
            }));
            self.sessions.lock().await.insert(
                id.clone(),
                Session {
                    commands: tx,
                    events: events.clone(),
                },
            );
            let sessions = self.sessions.clone();
            let key = id.clone();
            tokio::spawn(async move {
                let _permit = permit;
                runner::run(&mut wire, &mut rx, &events).await;
                let _ = wire.stop().await;
                // Keep terminal events available briefly, then release the session record.
                tokio::time::sleep(Duration::from_secs(3)).await;
                sessions.lock().await.remove(&key);
            });
            Ok(VoiceSession { id, sdp: answer })
        })
    }
    fn events(&self, id: String, after: u64) -> RepositoryFuture<'_, VoiceEvents> {
        Box::pin(async move {
            let session = self.session(&id).await?;
            let mut data = session.events.lock().await;
            data.last_seen = Some(Instant::now());
            if after > data.cursor {
                return Err(Failure::invalid("Invalid voice event cursor"));
            }
            while data
                .items
                .front()
                .is_some_and(|event| event.cursor <= after)
            {
                data.items.pop_front();
            }
            Ok(VoiceEvents {
                events: data.items.iter().cloned().collect(),
                cursor: data.cursor,
            })
        })
    }
    fn result(&self, id: String, call_id: String, content: String) -> RepositoryFuture<'_, ()> {
        Box::pin(self.send(id, content, Some(call_id)))
    }
    fn context(&self, id: String, content: String) -> RepositoryFuture<'_, ()> {
        Box::pin(self.send(id, content, None))
    }
    fn stop(&self, id: String) -> RepositoryFuture<'_, ()> {
        Box::pin(async move {
            if let Some(session) = self.sessions.lock().await.remove(&id) {
                let _ = session.commands.send(Command::Stop).await;
            }
            Ok(())
        })
    }
}
fn unavailable() -> Failure {
    Failure::new(
        "voice_unavailable",
        "Local Codex voice session is unavailable",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn event_backlog_is_bounded_and_cursor_monotonic() {
        let mut events = Events::default();
        for cursor in 1..=MAX_EVENTS {
            assert!(events.push("transcript", None, Some("hello".into()), None));
            assert_eq!(events.cursor, cursor as u64);
        }
        assert!(!events.push("execute_codex", None, None, None));
        assert_eq!(events.items.len(), MAX_EVENTS);
    }
}
