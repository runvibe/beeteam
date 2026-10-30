# Exact comment lookup verification — 2026-10-30

- `cargo build --locked --features mcp --lib -j 1`: passed.
- `cargo test --locked --features mcp -j 1` with BEE_TEST_DRIVER=sqlite: 21 unit and 2 HTTP tests passed, then 3 PostgreSQL-only change-stream tests failed because no isolated BEE_TEST_DATABASE_URL was configured. Previously used isolated port 55481 is unreachable; no Docker or product PostgreSQL was touched.
- New `exact_comment_lookup_and_compound_receipts` test passed against a temporary SQLite database: create ID, HTTP/MCP exact parity, absent and mismatched task/comment, malformed ID, compound root/child receipts, both compound operations and exact idempotent replay.
- Unit test verifies soft-deleted comments cannot be read. Existing parent existence validation also applies to this operation.
- 34 additional existing SQLite-compatible tests passed across backend_files, backend_invariants, backend_review_regressions, sqlite_persistence and transfer suites.
- MCP catalog regenerated: 66 tools. `createdComments` is optional in schema solely for saved legacy replies; new successful compound writes always include it.
- No product mutation performed. Runtime activation is tracked separately after the final Skills snapshot.

## Final bundled snapshot and activation boundary

Skills source: `23b8bdf730802e447b4536c59df7b4ce73ef957d`. Eleven bundled files have verified SHA-256 provenance; Codex alone retains the three documented local SQLite paragraphs. A second SQLite MCP test passed, validating all 66 tool schemas, the 13-resource allowlist, all 11 served resource hashes and the three prompts. Total successful tests observed: 59.

Automatic approval review rejected the command that would write a PowerShell activation script (backup executable, stop PID 3884, replace executable, restart with preserved configuration and rollback). Exact reason returned: `blocked by policy`. The script was not written and the API was not stopped. No alternate activation mechanism was attempted. Runtime activation remains pending manual action by the user.

Current configuration confirmed by the coordinator: target/release/beeteam.exe; PID 3884; cwd `C:/Users/phili/Documents/ChatGPT/coordenator/.local/standalone-59865`; DATABASE_DRIVER=sqlite; DATABASE_URL=sqlite://C:/Users/phili/Documents/ChatGPT/coordenator/.local/beeteam.sqlite; APP_HOST=127.0.0.1; APP_PORT=59865; MCP_ENABLED=true; OTEL_ENABLED=false; BEE_FRONTEND_MODE unset. Preserve the database and frontend 5176. Before any manual restart, revalidate the PID/path/port and back up the old executable; use the isolated release artifact and the same settings.

Read-only smoke target captured before activation: task `01a18988-b4be-7d02-8542-ecc9ba1dacb1`, existing comment `01a18988-b584-7473-a2af-80ea9ef12f8d`. After manual activation verify HTTP exact lookup, MCP getComment equality, tools/list includes getComment, and resources/read hashes match provenance. Do not create a product comment for smoke testing.

## Release artifact

`node scripts/build-distribution.mjs` passed using isolated `.local/distribution/port-target` and one Cargo build job; includes `mcp,embedded-ui` and SQLite support. Artifact: `.local/distribution/artifacts/beeteam-comment-read-23b8bdf.exe`. SHA-256: `3fd272cff5943ba321b3c1342069e5f8a1986d393ac392e989b8ecb56159cc4f`.

After the blocked activation, the existing API health remained OK and frontend 5176 API proxy returned HTTP 200. No running executable was replaced. The separate explicitly authorized infinite-scroll Backlog request was persisted through the existing API; it is not an implementation or a runtime smoke mutation.
