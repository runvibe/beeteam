# PostgreSQL repository boundaries

**Goal:** keep all PostgreSQL access and driver details in repositories, preserving HTTP/MCP contracts and existing data. SQLite is out of scope.

**Architecture:** application composition injects a backend service backed by repository interfaces. Repository-owned units of work hide SQL transactions. Reads use consistent snapshots without the mutation advisory lock; writes retain transactional constraints, replay handling and commit-only notifications. Filtering/pagination belong to repository queries, while hierarchy/autonomy policies remain in services.

**Stack:** Rust, Axum, SQLx, PostgreSQL 18.

- [x] Add regression tests for layer boundaries and reads during an open write transaction.
- [x] Introduce repository contracts, encapsulate transactions, move SQL error mapping and database initialization into repositories; compose services once in AppState.
- [x] Separate reads from writes and provide repository query operations with bounded reads/pagination, preserving hierarchy and filtering semantics.
- [x] Run cargo build and the complete test suite against isolated PostgreSQL, document the architecture and commit the change.

Tests must never use the product database. No runtime restart or data migration is required by this refactor.

Validation: cargo build --locked --features mcp --target x86_64-pc-windows-msvc and cargo test with the same flags passed (47 tests), using isolated PostgreSQL 18 on port 55481. Review found and corrected numeric attachment-size sorting, with ascending/descending pagination regression coverage. Product API and database were not restarted or modified.
