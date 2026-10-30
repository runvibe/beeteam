use crate::{dto::changes::Change, repositories::contracts::ChangeSource};
use std::sync::Arc;
use std::time::Duration;
use tokio::{sync::broadcast, task::JoinHandle};
pub struct ChangeFeed {
    sender: broadcast::Sender<Change>,
    task: JoinHandle<()>,
}
impl ChangeFeed {
    pub fn new(repository: Arc<dyn ChangeSource>) -> Self {
        let (sender, _) = broadcast::channel(64);
        let output = sender.clone();
        let task = tokio::spawn(async move {
            loop {
                if repository.is_closed() {
                    break;
                }
                if let Ok(mut listener) = repository.connect().await {
                    let _ = output.send(Change::Reset);
                    loop {
                        match listener.next().await {
                            Ok(true) => {
                                let _ = output.send(Change::Invalidate);
                            }
                            Ok(false) | Err(_) => break,
                        }
                    }
                }
                // No busy polling; every successful re-subscription forces a full refetch.
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        });
        Self { sender, task }
    }
    pub fn subscribe(&self) -> broadcast::Receiver<Change> {
        self.sender.subscribe()
    }
}
impl Drop for ChangeFeed {
    fn drop(&mut self) {
        self.task.abort();
    }
}
