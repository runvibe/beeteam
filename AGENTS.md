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

- HTTP and MCP adapt the same DTO validation and business services; compound MCP writes must use one database transaction and one idempotency key.
- The checked-in Kanban/RA OpenAPIs define the current boards/tasks model; never restore workspace or task/team ownership from older notes.
- Actor context is declared metadata, not authentication. Do not introduce a leader editing restriction while that product policy remains unresolved.
- MCP resources/prompts use an explicit bundled Bee Team allowlist under resources/bee-team. Never expose arbitrary files or imply global skill installation. Update provenance when refreshing the Skills snapshot.
- Regenerate docs/mcp-catalog.json using `cargo run --locked --features mcp --example mcp_catalog` after catalog/schema changes.
- Integration tests use an isolated PostgreSQL >=18 instance via BEE_TEST_DATABASE_URL (CREATEDB required for HTTP/MCP tests). Windows Docker wrappers calling WSL may require this URL instead of native Testcontainers. Never point tests at product data.
