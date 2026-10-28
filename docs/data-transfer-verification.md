# Portable transfer delivery — 2026-10-28

Base: `1f7a9ed`, including the PostgreSQL/SQLite repository boundary from `4f2dc2b`.
Implementation is local to `codex/beeteam-backend`; no publication, production
data transfer, production migration or active-service restart was performed.

## Delivered behavior

- ZIP64-capable version-1 package: manifest, 17 JSONL groups and UUID-addressed
  blobs; per-entry SHA-256 and whole-package digest; bounded rows, chunks,
  archive size, expansion, entries, reference index, duration and disk checks.
- PostgreSQL repeatable-read and SQLite pinned WAL snapshots; explicit rejection
  of unsupported PostgreSQL legacy data.
- Empty-only transactional restore with the existing writer lock, parent-first
  insertion, constraints retained, sequence floor, one notification and a durable
  completion marker. UUIDs, payloads, versions, history, tombstones, slug
  reservations, attachments and replay responses are preserved.
- Strict typed timestamp precision by default; explicit microsecond truncation
  changes metadata only. JSON/Markdown and date-looking replay strings stay intact.
- Durable jobs, OS lease shared across processes, administrative idempotency,
  previews tied to archive/destination/confirmation, streaming HTTP transfer,
  cancellation, retention and marker-based interrupted-restore reconciliation.
- HTTP contract exposed in Swagger and `docs/data-transfer-openapi.json`; five
  MCP tools share the service. Regenerated catalog: 65 tools, 13 resources,
  three prompts. No arbitrary filesystem/URL or binary payload MCP arguments.
- Global settings dialog with upload/hash progress, preview counts, precision
  acceptance, restore confirmation, download, cancellation and persisted job ID.
  Background application views retain their mounted state; completion cancels
  stale queries before invalidating data, without navigation or automatic saves.

## Executed checks

| Boundary | Evidence |
| --- | --- |
| PostgreSQL → PostgreSQL | `transfer_roundtrip::postgres_postgres` |
| PostgreSQL → SQLite | `transfer_roundtrip::postgres_sqlite` |
| SQLite → PostgreSQL | `transfer_roundtrip::sqlite_postgres` |
| SQLite → SQLite | `transfer_roundtrip::sqlite_sqlite` |
| Full dataset semantics | All 17 groups, cross-board child preceding parent, original payloads/versions, tombstones, 150,000-byte blob, replay snapshot, future sequence and exactly one invalidation |
| Concurrent export | Both drivers preserve the original snapshot while a separate connection updates records; subsequent export sees the update |
| Rollback/precision | Duplicate-ID rollback on both drivers; strict nanosecond rejection after prior inserts; explicit truncation leaves payload text unchanged |
| Malformed packages | Path traversal, absolute/unknown paths, symlink, duplicate ZIP name, unknown version, duplicate JSON keys, corrupt hash/CRC, truncation, row/entry/expanded limits |
| Domain validation | Orphan references, duplicate slugs, role conflict and cyclic task ancestry rejected |
| Jobs/recovery | Idempotent retries, payload mismatch, wrong destination confirmation, interrupted upload, cross-instance lease, expiry, post-commit journal recovery, uncertain commit and journal contention |
| Reopened destination | SQLite restored from real API-created domain data, reopened through a new repository/router, then identical agent response through HTTP and MCP |
| HTTP/MCP | Actual unapproved-Origin requests rejected; same idempotency key returns the same job across protocols; multipart above ordinary body limit; preview/restore/completed retry |
| Cancellation | Stalled multipart expires and releases lease; PostgreSQL writer-lock wait cancels; archive/domain validation check cancellation |
| Frontend | Incremental SHA-256 against standard vectors/chunk boundaries; persisted preview, strict confirmation/precision controls, disabled feature; full component suite and production build |

Commands used:

```text
cargo build --locked
cargo test --locked
cargo build --locked --features mcp
cargo test --locked --features mcp
cargo run --locked --features mcp --example mcp_catalog
npm run build
npm test
```

Rust integration runs used `OTEL_ENABLED=false`, a dedicated PostgreSQL 18 test
instance with CREATEDB access, and temporary SQLite files. The complete Rust
suite was run with the normal PostgreSQL HTTP-test selection and repeated with
`BEE_TEST_DRIVER=sqlite`; PostgreSQL-specific tests still use the isolated server.
The final MCP-enabled Rust suite passed 85 tests; the default-feature run passed 80 tests, and the SQLite-selected shared-suite run passed 84 tests before the final reopened-destination regression. That additional SQLite HTTP/MCP regression passed separately and in the final suite. The frontend suite contains 97 tests. Local command logs are ignored artifacts
named `backend-transfer-*.log`, not portable package contents.

Independent read-only review identified and verified fixes for ambiguous commit
classification, journal contention, stalled upload cancellation, quadratic
ancestor validation and uncancellable advisory-lock waits. Dedicated regressions
cover these cases. The final reconfirmation reported no remaining P1/P2 findings.

## Validation limit

The automatic approval review rejected starting a separate QA API/frontend for
interactive visual inspection, with only `blocked by policy` supplied as reason.
No workaround or use of production services was attempted. Browser visual
verification was therefore not performed; HTTP/MCP integration, component tests
and the frontend build are the executed UI-boundary evidence.

Switching an existing installation, deleting old data, deploying or restarting
its API remains a separate operational action. This delivery provides no force,
merge, reset or automatic cutover operation.
