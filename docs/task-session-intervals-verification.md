# Explicit task session interval verification

Implementation follows [contract](task-session-intervals-contract.md). Tracking is additive and optional until coordinated client rollout. No runtime activation or product data mutation is part of this change.

## Acceptance coverage

The dedicated HTTP/MCP suite covers sequential A=600/B=350 consumption, exclusion of between-task gaps, checkpoints without double counting, pause/resume A=500, paused finish without a boundary, concurrent same-source starts, different-agent conflicts, root/tree-child exclusion, stable replay IDs, compound rollback including comments, closed-range backdating, reconciliation overlap and overflow rollback, global model transitions, resets and declared lost coverage, per-model correction references, authoritative received timestamps, real zero, independent-session duration union, pagination-independent totals, and open-interval recovery.

Library regressions cover segment calculations and relational counter-series removal/reintroduction. Prior calculation revisions are immutable database rows; correcting an interval never rewrites original usage observations or summaries. The existing usage suite covers legacy reads and exact historical replay behavior.

## Transfer and storage

Separate SQLite and PostgreSQL migrations add five relational groups with FK/index columns, open source/root and source/session uniqueness independent of agent/model/epoch, and immutable calculation revisions. Source/session coverage-root changes cannot evade exclusivity. Closed ranges are checked by the serialized service during writes and corrections.

Transfer fixtures include all five new groups and values above JavaScript integer precision. Old archives with none of the new groups are accepted as empty historical tracking; partial sets are rejected. Original archive bytes, manifests and replay payloads are unchanged. Existing empty-destination, commit-marker, cancellation and precision policies are retained.

## Environment and commands

SQLite tests use temporary files with BEE_TEST_DRIVER=sqlite and OTEL_ENABLED=false. PostgreSQL uses the coordinator-provided disposable PostgreSQL18 container beeteam-intervals-test-20261103 on localhost55434; no product URL is used. Initial PG attempts were interrupted with SQLSTATE57P01 by an administrative fast shutdown. Keeping a WSL command alive stabilized that isolated container. Two PG test assertions were corrected to compare persisted timestamps rather than pre-persistence nanoseconds.

Final commands and counts are recorded below after completion. Logs are kept locally in .local/task-intervals-full-tests.log and .local/task-intervals-postgres-tests.log.

## Final results

- 132 distinct Rust tests passed with MCP enabled: the full invocation passed 112 before detecting an obsolete export assertion (17 groups rather than the new 22). The assertion now checks the exact declared group inventory; that target and all remaining targets passed (20 tests). No tests were filtered or ignored.
- All 10 HTTP/MCP interval scenarios additionally passed on isolated PostgreSQL18. SQLite used temporary files; PG-specific targets in the broader suite also used the isolated container.
- Transfer roundtrips passed SQLite→SQLite, SQLite→PostgreSQL, PostgreSQL→SQLite and PostgreSQL→PostgreSQL with the new groups; precision opt-in, rollback, stalled-upload cancellation and writer-lock cancellation passed.
- `cargo build --locked --features mcp -j1` passed. `cargo run --locked --features mcp --example mcp_catalog -j1` regenerated 78 tools, 16 resources and 3 prompts.
- All 14 source/bundle SHA256 pairs verified against Skills commit631072a1da56265c0f1b1d062e20b61db732cda0. Diff whitespace checks passed.

Reproduction: set BEE_TEST_DRIVER=sqlite, OTEL_ENABLED=false and BEE_TEST_DATABASE_URL to an isolated PostgreSQL18 database; run `cargo test --locked --features mcp -j1`. Repeat `--test backend_execution_intervals` with BEE_TEST_DRIVER=postgres. `.local/task-intervals-transfer-tests.log` records the successful continuation after the export assertion update; `.local/task-intervals-postgres-tests.log` records the 10-driver-parity scenarios.

No product database, API process or installed runtime was modified. Deployment and real UI acceptance remain integration responsibilities.
