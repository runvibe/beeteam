mod managed_fixture;
mod support;
use beeteam::{
    config::CorsConfig,
    dto::{
        backend::{Command, Failure},
        voice::*,
    },
    repositories::contracts::{RepositoryFuture, ResourceStore, UnitOfWork, VoiceProvider},
    services::{managed_agents::ManagedAgentService, voice::VoiceService},
};
use managed_fixture::*;
use serde_json::json;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicUsize, Ordering},
};
use support::*;
use uuid::Uuid;

fn transcript(cursor: u64, role: &str, content: &str) -> VoiceEvent {
    VoiceEvent {
        cursor,
        r#type: "transcript".into(),
        call_id: None,
        content: Some(content.into()),
        role: Some(role.into()),
    }
}
struct Stream {
    events: Vec<VoiceEvent>,
    cursor: u64,
    acknowledgements: Vec<u64>,
    stopped: bool,
}
struct FakeVoice {
    stream: Mutex<Stream>,
    starts: AtomicUsize,
    choices: Mutex<Vec<Option<String>>>,
    discoveries: AtomicUsize,
}
impl FakeVoice {
    fn new() -> Self {
        Self {
            stream: Mutex::new(Stream {
                events: vec![
                    transcript(1, "user", "Tell me about this project"),
                    transcript(2, "assistant", "We can discuss its design"),
                ],
                cursor: 2,
                acknowledgements: vec![],
                stopped: false,
            }),
            starts: AtomicUsize::new(0),
            choices: Mutex::new(vec![]),
            discoveries: AtomicUsize::new(0),
        }
    }
}
impl VoiceProvider for FakeVoice {
    fn voices(&self) -> RepositoryFuture<'_, Vec<String>> {
        Box::pin(async move {
            self.discoveries.fetch_add(1, Ordering::SeqCst);
            Ok(vec!["marin".into(), "cedar".into()])
        })
    }
    fn start(
        &self,
        _sdp: String,
        _instructions: String,
        voice: Option<String>,
    ) -> RepositoryFuture<'_, VoiceConnection> {
        Box::pin(async move {
            self.starts.fetch_add(1, Ordering::SeqCst);
            self.choices.lock().unwrap().push(voice);
            Ok(VoiceConnection {
                id: "test-voice-session".into(),
                sdp: "answer".into(),
            })
        })
    }
    fn events(&self, _id: String, after: u64) -> RepositoryFuture<'_, VoiceEvents> {
        Box::pin(async move {
            let mut stream = self.stream.lock().unwrap();
            stream.acknowledgements.push(after);
            stream.events.retain(|event| event.cursor > after);
            Ok(VoiceEvents {
                events: stream.events.clone(),
                cursor: stream.cursor,
            })
        })
    }
    fn result(&self, _id: String, _call_id: String, _content: String) -> RepositoryFuture<'_, ()> {
        Box::pin(async { Ok(()) })
    }
    fn context(&self, _id: String, _content: String) -> RepositoryFuture<'_, ()> {
        Box::pin(async { Ok(()) })
    }
    fn stop(&self, _id: String) -> RepositoryFuture<'_, ()> {
        Box::pin(async move {
            let mut stream = self.stream.lock().unwrap();
            if !stream.stopped {
                stream.cursor += 1;
                let cursor = stream.cursor;
                stream
                    .events
                    .push(transcript(cursor, "assistant", "Goodbye"));
                stream.stopped = true;
            }
            Ok(())
        })
    }
}
struct FailingStore {
    inner: Arc<dyn ResourceStore>,
    fail_next: AtomicBool,
}
impl ResourceStore for FailingStore {
    fn resolve_slug<'a>(
        &'a self,
        table: &'static str,
        slug: &'a str,
    ) -> RepositoryFuture<'a, (Uuid, String)> {
        self.inner.resolve_slug(table, slug)
    }
    fn begin(&self) -> RepositoryFuture<'_, UnitOfWork> {
        Box::pin(async move {
            if self.fail_next.swap(false, Ordering::SeqCst) {
                return Err(Failure::new(
                    "storage_unavailable",
                    "Injected storage failure",
                ));
            }
            self.inner.begin().await
        })
    }
    fn read<'a>(&'a self, command: &'a Command) -> RepositoryFuture<'a, UnitOfWork> {
        self.inner.read(command)
    }
}
struct Fixture {
    app: axum::Router,
    voice: VoiceService,
    managed: ManagedAgentService,
    fake: Arc<FakeVoice>,
    store: Arc<FailingStore>,
    agent: Uuid,
    team: Uuid,
}
async fn setup() -> Fixture {
    let (app, agent, team, provider, db) =
        fixture_with_repo(CorsConfig::Permissive, CorsConfig::Permissive).await;
    let store = Arc::new(FailingStore {
        inner: db.stores().0,
        fail_next: AtomicBool::new(false),
    });
    let managed =
        ManagedAgentService::new(store.clone()).with_provider(provider, "isolated".into());
    let fake = Arc::new(FakeVoice::new());
    let voice = VoiceService::new(fake.clone(), managed.clone());
    Fixture {
        app,
        voice,
        managed,
        fake,
        store,
        agent: Uuid::parse_str(id(&agent)).unwrap(),
        team: Uuid::parse_str(id(&team)).unwrap(),
    }
}
impl Fixture {
    fn start(&self, conversation: Option<Uuid>) -> StartVoice {
        StartVoice {
            sdp: "offer".into(),
            voice: None,
            agent_id: self.agent,
            team_id: Some(self.team),
            conversation_id: conversation,
        }
    }
    async fn messages(&self, conversation: Uuid) -> serde_json::Value {
        get(
            &self.app,
            &format!("/api/v2/agent-conversations/{conversation}/messages"),
        )
        .await
    }
}

#[tokio::test]
async fn both_speakers_are_durable_idempotent_history_without_execution() {
    let fixture = setup().await;
    let session = fixture.voice.create(fixture.start(None)).await.unwrap();
    assert!(
        fixture.messages(session.conversation_id).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    let (first, repeated) = tokio::join!(
        fixture.voice.events(session.id.clone(), 0),
        fixture.voice.events(session.id.clone(), 0)
    );
    assert_eq!(first.unwrap().events.len(), 2);
    assert_eq!(repeated.unwrap().events.len(), 2);
    let messages = fixture.messages(session.conversation_id).await;
    let items = messages["items"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["role"], "requester");
    assert_eq!(items[1]["role"], "agent");
    for message in items {
        assert_eq!(message["source"], "voice");
        assert!(message["requestId"].is_null());
        assert!(message.get("voiceSessionId").is_none());
    }
    let requests = get(
        &fixture.app,
        &format!("/api/v2/agents/{}/requests", fixture.agent),
    )
    .await;
    assert!(requests["items"].as_array().unwrap().is_empty());
    fixture
        .managed
        .persist_voice_transcripts(
            session.conversation_id,
            &session.id,
            &[
                transcript(1, "user", "Tell me about this project"),
                transcript(2, "assistant", "We can discuss its design"),
            ],
        )
        .await
        .unwrap();
    assert_eq!(
        fixture.messages(session.conversation_id).await["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let fresh = VoiceService::new(Arc::new(FakeVoice::new()), fixture.managed.clone());
    let resumed = fresh
        .create(fixture.start(Some(session.conversation_id)))
        .await
        .unwrap();
    assert_eq!(resumed.conversation_id, session.conversation_id);
    assert_eq!(
        fixture.messages(resumed.conversation_id).await["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[tokio::test]
async fn storage_failure_never_acknowledges_uncommitted_provider_events() {
    let fixture = setup().await;
    let session = fixture.voice.create(fixture.start(None)).await.unwrap();
    fixture.store.fail_next.store(true, Ordering::SeqCst);
    assert!(fixture.voice.events(session.id.clone(), 0).await.is_err());
    assert!(
        fixture.messages(session.conversation_id).await["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        fixture
            .voice
            .events(session.id.clone(), 0)
            .await
            .unwrap()
            .events
            .len(),
        2
    );
    assert_eq!(
        fixture.fake.stream.lock().unwrap().acknowledgements,
        vec![0, 0]
    );
    assert!(
        fixture
            .voice
            .events(session.id.clone(), 9999)
            .await
            .is_err()
    );
    assert_eq!(
        fixture.messages(session.conversation_id).await["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[tokio::test]
async fn stop_persists_buffered_final_speech_and_is_retryable() {
    let fixture = setup().await;
    let session = fixture.voice.create(fixture.start(None)).await.unwrap();
    fixture.store.fail_next.store(true, Ordering::SeqCst);
    fixture.voice.stop(session.id.clone()).await.unwrap();
    fixture.voice.stop(session.id.clone()).await.unwrap();
    let messages = fixture.messages(session.conversation_id).await;
    assert_eq!(messages["items"].as_array().unwrap().len(), 3);
    assert_eq!(messages["items"][2]["content"], "Goodbye");
}

#[tokio::test]
async fn wrong_agent_context_is_rejected_before_provider_start() {
    let fixture = setup().await;
    let session = fixture.voice.create(fixture.start(None)).await.unwrap();
    let other = ok(
        &fixture.app,
        "POST",
        "/api/v2/agents",
        json!({"name":"Other"}),
        None,
    )
    .await;
    let mut body = fixture.start(Some(session.conversation_id));
    body.agent_id = Uuid::parse_str(id(&other)).unwrap();
    assert!(fixture.voice.create(body).await.is_err());
    assert_eq!(fixture.fake.starts.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn available_voice_names_are_discovered_without_starting_conversation() {
    let fixture = setup().await;
    let options = fixture.voice.voices().await.unwrap();
    assert!(options.default_voice.is_none());
    assert_eq!(options.voices[0].id, "marin");
    assert_eq!(options.voices[0].name, "Marin");
    assert_eq!(fixture.fake.starts.load(Ordering::SeqCst), 0);
    let conversations = get(
        &fixture.app,
        &format!("/api/v2/agents/{}/conversations", fixture.agent),
    )
    .await;
    assert!(conversations["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn unavailable_voice_is_rejected_before_conversation_is_created() {
    let fixture = setup().await;
    let mut body = fixture.start(None);
    body.voice = Some("unavailable-choice".into());
    assert_eq!(
        fixture.voice.create(body).await.err().unwrap().code,
        "invalid_request"
    );
    assert_eq!(fixture.fake.starts.load(Ordering::SeqCst), 0);
    let conversations = get(
        &fixture.app,
        &format!("/api/v2/agents/{}/conversations", fixture.agent),
    )
    .await;
    assert!(conversations["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn explicit_voice_reaches_provider_and_default_skips_discovery() {
    let fixture = setup().await;
    fixture.voice.create(fixture.start(None)).await.unwrap();
    assert_eq!(fixture.fake.discoveries.load(Ordering::SeqCst), 0);
    assert_eq!(*fixture.fake.choices.lock().unwrap(), vec![None]);
    let mut body = fixture.start(None);
    body.voice = Some("cedar".into());
    fixture.voice.create(body).await.unwrap();
    assert_eq!(
        *fixture.fake.choices.lock().unwrap(),
        vec![None, Some("cedar".into())]
    );
}
