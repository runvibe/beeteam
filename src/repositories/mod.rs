//! Persistence and integration-facing structs live here.

pub mod database;
pub mod resources;

pub mod changes;

pub mod contracts;
mod errors;
pub mod records;

pub mod query;
mod reads;

pub mod sqlite;

pub mod frontend;
pub mod transfer;

mod participants;
