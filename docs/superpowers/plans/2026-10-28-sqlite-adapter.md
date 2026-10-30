# SQLite persistence adapter

**Goal:** opt into SQLite using environment configuration, keeping PostgreSQL the default. No data conversion, reset, or product database changes.

**Architecture:** select repository adapters at composition time. Share DTOs, services and HTTP/MCP transports. Use independent SQLite migrations, WAL/foreign keys, serialized write transactions, read snapshots, UUIDv7 and immutable slug reservations. A transactionally updated change counter supplies cross-process invalidation for SQLite; PostgreSQL keeps LISTEN/NOTIFY.

- [x] Test configuration selection and reject driver/URL mismatches.
- [x] Add SQLite schema, connection settings and ResourceStore/TransactionStore/ChangeSource adapters.
- [x] Exercise existing HTTP/MCP scenarios against temporary SQLite files; test persistence, concurrency, constraints, replay and notifications.
- [x] Run PostgreSQL regressions, build, review and document environment examples. Commit locally after validation.

Data export/import is a separate feature. Existing running services remain on PostgreSQL.

## Validation

- 57 tests passed with the PostgreSQL test configuration and 57 with shared HTTP/MCP scenarios configured for SQLite (PG-specific tests remain isolated PostgreSQL tests).
- Eight focused SQLite tests cover persistence/reopen, files, replay, slug reservations, concurrent writers, read snapshots, constraints, notifications, Unicode filters, exact timestamp ranges, role swaps and in-memory storage.
- Locked MCP build, five Python startup/bootstrap tests, PowerShell parsing and diff checks passed.
- Independent review approved specification compliance and code quality without actionable findings.
- Additional standalone process startup/reopen smoke was rejected by automatic approval review without a reason. No runtime-switch claim: product services and data remain unchanged.

## Scope decisions

The change is delivered in a local commit in the existing authorized checkout. Data export/import remains separate; changing the driver selects an independent database and never converts existing data.
