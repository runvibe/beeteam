# Agents

- Document and adjust each agent as provider workflows change.
- **Architecture**: keep transport concerns inside routes/, move reusable logic into dedicated modules, keep API/request/response contracts in dto/, and reserve repositories/ for DB, queue, cache, and external integration-facing structs.
- **SOLID rule**: all code changes must respect SOLID principles; prefer cohesive modules, explicit interfaces, and dependency direction that keeps high-level policy independent from low-level details.
- **Project structure**: routes/ handles transport and protocol wiring (HTTP and MCP), services/ owns business rules and use-case orchestration, dto/ defines request/response contracts plus validation/transformation structs, repositories/ defines persistence and external integration adapters; keep modules small and focused.
- **Layer rules**: routes/ may know transport concerns but must not contain business rules; services/ may orchestrate repositories and transform dto/ but must not depend on HTTP/MCP details; repositories/ may depend on external clients and storage drivers but must not return transport-layer responses; dto/ must not contain persistence access or business orchestration.
- **Flow rule**: prefer the direction `route -> dto -> service -> repository -> service -> dto -> route`; do not let routes call storage directly or repositories shape protocol responses.
- **Separation rule**: always split routes from services and repositories; do not mix request/response handling with business logic or data structs.
- **File size rule**: no source file should exceed 1000 lines; if a file reaches or exceeds that threshold, split it into smaller focused modules distributed in a way that preserves separation of concerns and respects SOLID principles.
- **Persistence**: prefer SQLx query macros with bound parameters, reuse migrations/, and avoid inline schema drift.
- **Processes**: discuss changes via PROJECT.md conventions, open pull requests with review context, and keep agents.md current when workflows shift.
- Run cargo build after any modification to ensure the project still compiles.
- Execute cargo test to validate all tests pass after changes.
- Commit changes with clear messages reflecting the modifications made.
- Write tests for new features or bug fixes to ensure code quality.
- Update documentation in README.md to reflect new features or changes.

## Backend / MCP workflow

- Compose `BackendService` and repository adapters in `AppState`; controllers receive services, never pools or concrete repositories. Services depend on `repositories/contracts.rs`, not SQLx or PostgreSQL adapters. Keep transaction handles private and translate SQL driver errors within repositories.
- Read queries use repository-owned repeatable-read, read-only snapshots with database filtering/order/pagination and targeted context hydration. Do not reintroduce the global write lock or full-resource preload on GET/prepare_execution. Writes retain the existing serialized UnitOfWork until a separately validated concurrency redesign.

- HTTP and MCP adapt the same DTO validation and business services; compound MCP writes must use one database transaction and one idempotency key.
- The checked-in Kanban/RA OpenAPIs define the current boards/tasks model; never restore workspace or task/team ownership from older notes.
- Actor context is declared metadata, not authentication. Do not introduce a leader editing restriction while that product policy remains unresolved.
- MCP resources/prompts use an explicit bundled Bee Team allowlist under resources/bee-team. Never expose arbitrary files or imply global skill installation. Update provenance when refreshing the Skills snapshot.
- Distribute the standalone setup skill from the same immutable GitHub release tag as the app and the role skills. Bootstrap must work before MCP is available. Validate the three packages with the skills CLI in isolated harness directories; verify the release artifact and an actual local health/info response before claiming the app is ready.
- Regenerate docs/mcp-catalog.json using `cargo run --locked --features mcp --example mcp_catalog` after catalog/schema changes.
- Integration tests use an isolated PostgreSQL >=18 instance via BEE_TEST_DATABASE_URL (CREATEDB required for HTTP/MCP tests). Windows Docker wrappers calling WSL may require this URL instead of native Testcontainers. Never point tests at product data.

- Work updates must supply the worker-authored cumulative `currentSummary` with progress/status changes and activity closure. Keep it separate from historical `summary` and descriptive notes; never generate it from history. Preserve atomicity, idempotency (including legacy response snapshots), and empty legacy state in HTTP/MCP parity tests.

- Preserve task `specification` and plan/revision `content` as Markdown text (65536 UTF-8 bytes), without rendering or executing it. Keep requirements, short description, execution plans, and current work synthesis independent; specification-only edits do not require a new work summary.

- Agent/team/task slugs are immutable URL aliases, never internal identifiers. Resolve via the typed by-slug endpoint/tool, then keep UUIDv7 in mutations and prompt arguments. Preserve deleted slug reservations and keep migration/application advisory lock ordering consistent before table access.

- Team role icons use the closed `docs/team-role-icons.json` catalog and matching OpenAPI ID enum. Persist only `leaderIconId`/`workerIconId`; services resolve legacy defaults and representations without rewriting stored records. Render only bundled SVG assets in the UI. Keep team role symbols separate from agent identity and task status/autonomy symbols. Source/bundled skills resolve the actual team and active role before changing their own chat prefix, skip unchanged titles and verify readback when available; never bulk-rename other existing chats. Refresh bundled provenance and generated contracts/catalog after changes.

- SQLite is the default, using ~/.beeteam/beeteam.sql when no database override is provided. Explicit DATABASE_URL is preserved (infer its PostgreSQL scheme when DATABASE_DRIVER is omitted); explicit driver/URL must match. Create missing SQLite parent directories only when opening persistence. Keep independent migrations in migrations/sqlite, WAL/foreign_keys on every connection, serialized BEGIN IMMEDIATE mutations and bounded snapshot reads. ResourceStore/TransactionStore/ChangeSource own normal persistence; TransferDatabase owns portable snapshot/restore integration. Do not convert/reset existing product databases.
- BEE_TEST_DRIVER=sqlite routes shared HTTP/MCP app() tests to temporary files; app_with_pool and PostgreSQL-specific tests still require isolated PostgreSQL >=18. Set OTEL_ENABLED=false when Jaeger is unavailable. Verify both drivers after persistence changes.

- Portable transfer is administratively opt-in and empty-destination-only. Keep archive, blob, journal and OS lease access in repositories/transfer; HTTP/MCP share the transfer service. Preserve raw domain/replay JSON and Markdown. Typed submicrosecond metadata requires explicit truncation approval for PostgreSQL. A DB commit marker overrides late cancellation; an unknown commit outcome stays restoring until writer-lock-protected reconciliation. Never add force/reset/cutover implicitly. Verify cancellation during stalled uploads and writer-lock waits, plus all four driver pairs, before changing this workflow.

- Single-binary distribution uses `node scripts/build-distribution.mjs` and Cargo `embedded-ui`; frontend dependencies/build output live in isolated `.local/distribution/frontend`. Keep source/output hash verification, production/same-origin build settings, and the repository/service/HTTP split. Never fall back to SPA HTML for API/MCP or missing assets. Preserve API-only/Vite development and do not restart active services to validate packaging.

## Release changelog

Every pull request with a user-visible change must update the root CHANGELOG.md. Collect pending changes under Unreleased. Before publishing, move them into a nonempty version section matching Cargo.toml, merge it into main, and publish that exact section as the GitHub Release notes. Describe observable changes in English.
