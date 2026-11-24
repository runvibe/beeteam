//! The startup onboarding seed (Bee Team HQ) tags every row it creates with
//! `data.onboardingSeedVersion == version`. While such rows are untouched ("pristine"), they
//! do not make a destination non-empty, and restore removes them before importing so a fresh
//! installation can still receive a portable archive.

/// Seed tables in child-first order for deletion.
const TABLES: &[&str] = &[
    "events",
    "tasks",
    "statuses",
    "boards",
    "memberships",
    "teams",
    "agents",
];

#[derive(Clone, Copy)]
pub(super) enum Dialect {
    Sqlite,
    Postgres,
}

// Never NULL: rows without the marker must count as user data.
fn pristine(dialect: Dialect) -> &'static str {
    match dialect {
        Dialect::Sqlite => {
            "json_extract(data,'$.onboardingSeedVersion') IS version AND archived_at IS NULL AND deleted_at IS NULL"
        }
        Dialect::Postgres => {
            "data->'onboardingSeedVersion' IS NOT DISTINCT FROM to_jsonb(version) AND archived_at IS NULL AND deleted_at IS NULL"
        }
    }
}

/// Counts rows that make `table` non-empty, ignoring pristine onboarding seed rows.
pub(super) fn count(table: &str, dialect: Dialect) -> String {
    if TABLES.contains(&table) {
        format!("SELECT count(*) FROM {table} WHERE NOT ({})", pristine(dialect))
    } else {
        format!("SELECT count(*) FROM {table}")
    }
}

/// Statements that remove pristine seed rows; delete guards only admit them inside this window.
pub(super) fn deletions(dialect: Dialect) -> Vec<String> {
    let (open, close) = match dialect {
        Dialect::Sqlite => (
            "INSERT INTO beeteam_seed_cleanup(singleton) VALUES(1)",
            "DELETE FROM beeteam_seed_cleanup",
        ),
        Dialect::Postgres => (
            "SET LOCAL beeteam.seed_cleanup = 'on'",
            "SET LOCAL beeteam.seed_cleanup = 'off'",
        ),
    };
    std::iter::once(open.to_string())
        .chain(
            TABLES
                .iter()
                .map(|table| format!("DELETE FROM {table} WHERE {}", pristine(dialect))),
        )
        .chain(std::iter::once(close.to_string()))
        .collect()
}
