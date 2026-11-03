# Required cumulative session totals verification

New execution summaries require measured cumulative snapshots for session or session_tree, an identified model, a persisted agent UUIDv7, and decimal-string totalTokens equal to inclusive inputTokens + outputTokens. Cache/reasoning are subsets. A first snapshot is valid without a predecessor or delta; the snapshot does not imply exclusive task attribution.

The shared HTTP/MCP validator runs after saved replay lookup. General observations and late reconciliation retain historical partial/unavailable forms. No migration or product-data rewrite is needed.

Validation on 2026-11-02 used BEE_TEST_DRIVER=sqlite and OTEL_ENABLED=false with temporary isolated databases:

- 52 tests passed: 27 library, 12 usage, 2 MCP, 1 OpenAPI examples, 4 status summaries, 2 API, 1 board/subtasks, 2 overview, and 1 participants.
- The new-summary unit regression failed before enforcement and passed afterward. It covers missing/mismatched totals, unavailable/estimated usage, missing models/agents, exact integers beyond JavaScript precision, and int64 overflow.
- HTTP/MCP/compound tests verify atomic rejection, persisted-agent lookup, first baselines, disjoint models, session_tree, legacy reads and exact saved replays.
- Three PostgreSQL-only tests were explicitly filtered. PostgreSQL validation was waived for this delivery; no PostgreSQL result is claimed.

Skills source 388415e855004317b367fe55f6df47d5d6993299 is bundled with existing SQLite/bootstrap overlays preserved. Final bundle checks, catalog generation and build results are recorded in docs/mcp-catalog.md. No runtime restart or product-data mutation occurred.
