# Summary usage verification — 2026-10-31

## Scope

Optional structured evidence on execution summaries, late append-only reconciliation,
SQL task totals and paginated model/harness/checkpoint reads, and Overview integration.
HTTP and MCP share DTO validation and services. Markdown and current task state remain
independent from late usage reconciliation. See [contracts and limits](summary-usage.md).

## Validation environment

Tests use BEE_TEST_DRIVER=sqlite with temporary databases and OTEL_ENABLED=false.
The release target is isolated under .local/distribution/port-target; no active
service was restarted and no product database was used or migrated.

PostgreSQL adapter and migration are included, but PostgreSQL integration execution
is pending: BEE_TEST_DATABASE_URL was not configured and the previously designated
isolated port 55481 was unreachable. The PostgreSQL-only MCP compound test is excluded
from the SQLite run; this is not a claim that the entire repository suite passed.

## Passed checks

`cargo build --locked --features mcp --lib -j 1` passed.
The complete executable build also passed with
`cargo build --locked --release --features mcp -j 1` in the isolated target.

With the isolated target and SQLite environment above:

```text
cargo test --locked --release --features mcp -j 1 --lib
  --test backend_usage --test backend_overview --test backend_api
  --test backend_participants --test backend_comment_filters
  --test sqlite_persistence --test backend_mcp
  -- --skip sdk_tools_resources_prompts_and_atomic_compounds
```

44 tests passed: 22 unit, 6 usage, 2 Overview, 2 API, 1 participants,
1 comment filters, 8 SQLite persistence and 2 MCP tests. One PostgreSQL-only
MCP test was explicitly filtered out. Usage cases exercise baseline/delta
accounting, repeated evidence, optional/late reports, exact replay, HTTP/MCP
parity, rollback, missing versus zero, more than 100 model dimensions,
int64 overflow and overlapping sources.

`cargo run --locked --features mcp --example mcp_catalog -j 1` passed;
the regenerated catalog matches the checked-in contract. `git diff --check`
passed.

## Contract and bundle checks

All 469 local OpenAPI references resolve. Bundled provenance validates all 12 file
hashes against source revision 868ff91e09669ab7a13aa0aef86c8bd6eb695d91, retaining
the existing SQLite startup overlay. The generated MCP catalog exposes 71 tools
and 14 resources, including the optional usage reference.

## Remaining acceptance

Integrate the frontend delivery, execute PostgreSQL integration tests against an
isolated PostgreSQL 18 instance, and validate the activated application separately.
No external usage collector or automatic historical backfill is installed. Missing
evidence remains unknown, never zero or fabricated consumption.
