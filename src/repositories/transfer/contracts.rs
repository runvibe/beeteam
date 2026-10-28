use super::archive::ArchiveStore;
use crate::dto::data_transfer::{Manifest, TimestampPolicy};
use std::{future::Future, pin::Pin, sync::Arc};
use uuid::Uuid;
pub type TransferFuture<'a, T> = Pin<Box<dyn Future<Output = anyhow::Result<T>> + Send + 'a>>;
#[derive(Clone, Debug)]
pub struct Destination {
    pub id: Uuid,
    pub driver: String,
    pub empty: bool,
}
pub trait TransferDatabase: Send + Sync {
    fn destination(&self) -> TransferFuture<'_, Destination>;
    fn export<'a>(&'a self, store: Arc<ArchiveStore>, id: Uuid) -> TransferFuture<'a, Manifest>;
    fn restore<'a>(
        &'a self,
        store: Arc<ArchiveStore>,
        id: Uuid,
        manifest: Manifest,
        expected: Uuid,
        policy: TimestampPolicy,
        hash: String,
    ) -> TransferFuture<'a, ()>;
    fn committed(&self, id: Uuid) -> TransferFuture<'_, bool>;
}
