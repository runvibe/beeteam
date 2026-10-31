# Task overview verification

Validated on 2026-10-31 in the backend worktree. Runtime activation is separate.

- `GET /api/v1/tasks/{taskId}/overview` and MCP `getTaskOverview` share the
  contract and snapshot-backed service. Catalog contains 68 tools.
- SQL aggregates cover all nondeleted direct children across boards, including
  archived children; grandchildren and unrelated tasks are excluded.
- Progress history contains only explicit `task.updated` progress events;
  execution summaries do not retroactively manufacture progress timestamps.
- Summary authorship is returned only when the recorded summary matches the
  current summary. Missing next-step/decision sources remain null/empty.
- Deliverables span all execution summaries. Attachments, events, progress and
  deliverables expose limits, totals and truncation instead of implying completeness.
- Task lists accept `includeArchived=true` for consistent drilldowns. Default
  remains active-only; explicit `archived` combined with `includeArchived` is 400.

Command (PowerShell; isolated target avoids the running debug executable):

```powershell
$env:BEE_TEST_DRIVER='sqlite'
$env:OTEL_ENABLED='false'
$env:CARGO_TARGET_DIR=(Join-Path (Get-Location) '.local/distribution/port-target')
cargo test --locked --release --features mcp -j 1 --lib --test backend_overview --test backend_participants --test backend_comment_filters --test sqlite_persistence
```

Result: 33 passed, 0 failed (21 unit, 2 overview, 1 participants, 1 comment
filters, 8 SQLite persistence). Overview fixtures cover 55 cross-board direct
children, archived drilldown, 103 progress events with a 100-event limit,
deliverables in older summaries, bounded attachments/events, HTTP/MCP parity,
invalid/missing IDs and unchanged task state. A concurrent-write test proves
snapshot consistency and that overview context does not preload child bodies.

Catalog generated with `cargo run --locked --features mcp --example mcp_catalog`.
PostgreSQL-specific execution is not claimed: the isolated PostgreSQL test
instance was unavailable. No product writes, resets or service restarts occurred.
Frontend visual/runtime acceptance remains with the integrated release operator.

Additional final checks:

- `cargo build --locked --release --features mcp -j 1` passed in the same
  isolated target. Executable: `.local/distribution/port-target/release/beeteam.exe`.
  SHA-256: `a0c35446859d3fd42273baf9a604486e481d34d69f43b239e7d8c38dffb1421b`.
- `cargo test --locked --release --features mcp -j 1 --test backend_mcp`
  passed `bundled_comment_protocol_catalog_and_hashes` and
  `exact_comment_lookup_and_compound_receipts`.
- Its third test, `sdk_tools_resources_prompts_and_atomic_compounds`, failed
  during fixture setup because `BEE_TEST_DATABASE_URL` was absent; it uses the
  PostgreSQL-only fixture even with `BEE_TEST_DRIVER=sqlite`. The isolated
  PostgreSQL port 55481 was independently confirmed unreachable. This is not
  reported as a fully passing MCP suite.

Total completed passing tests across these commands: 35. The one PostgreSQL
fixture remains an infrastructure prerequisite for integrated validation.
