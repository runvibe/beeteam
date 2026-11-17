//! Driver-independent persistence contracts used by application services.
use super::records::Records;
use crate::dto::backend::{Command, Outcome, Result};
use std::{future::Future, pin::Pin};
use uuid::Uuid;

pub type RepositoryFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T>> + Send + 'a>>;

/// Local harness adapters own protocol I/O; services own recipients and delivery state.
pub trait SessionProvider: Send + Sync {
    /// Structured delivery identity for adapters that route approvals and history.
    fn deliver_context<'a>(
        &'a self,
        destination: &'a crate::dto::session_delivery::SessionDestination,
        text: &'a str,
        events: tokio::sync::mpsc::Sender<crate::dto::session_delivery::SessionEvent>,
        _delivery_id: Uuid,
    ) -> Pin<
        Box<
            dyn Future<
                    Output = std::result::Result<(), crate::dto::session_delivery::SessionFailure>,
                > + Send
                + 'a,
        >,
    > {
        self.deliver(destination, text, events)
    }
    fn deliver<'a>(
        &'a self,
        destination: &'a crate::dto::session_delivery::SessionDestination,
        text: &'a str,
        events: tokio::sync::mpsc::Sender<crate::dto::session_delivery::SessionEvent>,
    ) -> Pin<
        Box<
            dyn Future<
                    Output = std::result::Result<(), crate::dto::session_delivery::SessionFailure>,
                > + Send
                + 'a,
        >,
    >;
}

pub trait ChangeSource: Send + Sync {
    fn is_closed(&self) -> bool;
    fn connect(&self) -> RepositoryFuture<'_, Box<dyn ChangeStream>>;
}
pub trait ChangeStream: Send {
    fn next(&mut self) -> RepositoryFuture<'_, bool>;
}

pub trait ResourceStore: Send + Sync {
    fn resolve_slug<'a>(
        &'a self,
        table: &'static str,
        slug: &'a str,
    ) -> RepositoryFuture<'a, (Uuid, String)>;
    fn begin(&self) -> RepositoryFuture<'_, UnitOfWork>;
    fn read<'a>(&'a self, command: &'a Command) -> RepositoryFuture<'a, UnitOfWork>;
}

/// The driver owns transaction lifecycle. Services only operate on the working records.
pub trait TransactionStore: Send + Sync {
    fn select<'a>(
        &'a mut self,
        command: &'a Command,
    ) -> RepositoryFuture<'a, super::records::Selection>;
    fn allocate_slug<'a>(
        &'a mut self,
        table: &'a str,
        label: &'a str,
    ) -> RepositoryFuture<'a, String>;
    fn replay<'a>(
        &'a mut self,
        actor: &'a str,
        operation: &'a str,
        key: Uuid,
        hash: &'a str,
    ) -> RepositoryFuture<'a, Option<Outcome>>;
    fn save_replay<'a>(
        &'a mut self,
        actor: &'a str,
        operation: &'a str,
        key: Uuid,
        hash: &'a str,
        result: &'a Outcome,
    ) -> RepositoryFuture<'a, ()>;
    fn put_file<'a>(&'a mut self, bytes: &'a [u8]) -> RepositoryFuture<'a, Uuid>;
    fn file(&mut self, id: Uuid) -> RepositoryFuture<'_, Vec<u8>>;
    fn delete_file(&mut self, id: Uuid) -> RepositoryFuture<'_, ()>;
    fn sequence(&mut self) -> RepositoryFuture<'_, i64>;
    fn rollback(self: Box<Self>) -> RepositoryFuture<'static, ()>;
    fn commit(self: Box<Self>, records: Records) -> RepositoryFuture<'static, ()>;
}

pub struct UnitOfWork {
    pub records: Records,
    transaction: Box<dyn TransactionStore>,
}
impl UnitOfWork {
    pub async fn select(&mut self, command: &Command) -> Result<super::records::Selection> {
        let selection = self.transaction.select(command).await?;
        self.records.rows.extend(selection.records.rows.clone());
        Ok(selection)
    }

    pub(crate) fn new(records: Records, transaction: Box<dyn TransactionStore>) -> Self {
        Self {
            records,
            transaction,
        }
    }
    pub async fn allocate_slug(&mut self, table: &str, label: &str) -> Result<String> {
        self.transaction.allocate_slug(table, label).await
    }
    pub async fn replay(
        &mut self,
        actor: &str,
        operation: &str,
        key: Uuid,
        hash: &str,
    ) -> Result<Option<Outcome>> {
        self.transaction.replay(actor, operation, key, hash).await
    }
    pub async fn save_replay(
        &mut self,
        actor: &str,
        operation: &str,
        key: Uuid,
        hash: &str,
        result: &Outcome,
    ) -> Result<()> {
        self.transaction
            .save_replay(actor, operation, key, hash, result)
            .await
    }
    pub async fn put_file(&mut self, bytes: &[u8]) -> Result<Uuid> {
        self.transaction.put_file(bytes).await
    }
    pub async fn file(&mut self, id: Uuid) -> Result<Vec<u8>> {
        self.transaction.file(id).await
    }
    pub async fn delete_file(&mut self, id: Uuid) -> Result<()> {
        self.transaction.delete_file(id).await
    }
    pub async fn sequence(&mut self) -> Result<i64> {
        self.transaction.sequence().await
    }
    pub async fn rollback(self) -> Result<()> {
        self.transaction.rollback().await
    }
    pub async fn commit(self) -> Result<()> {
        self.transaction.commit(self.records).await
    }
}

/// Read-only inspection of only the explicitly supplied folders. Failures are observations.
pub use super::project_discovery::{GitBranch, GitInspection, GitRemote};
pub trait ProjectDiscovery: Send + Sync {
    fn discover<'a>(
        &'a self,
        roots: &'a [String],
    ) -> Pin<Box<dyn Future<Output = Vec<GitInspection>> + Send + 'a>>;
}

/// OS integration only; the service resolves registered projects before calling.
pub trait ProjectOpener: Send + Sync {
    fn open<'a>(
        &'a self,
        root: &'a str,
        application: crate::dto::local_projects::ProjectApplication,
    ) -> RepositoryFuture<'a, ()>;
}
