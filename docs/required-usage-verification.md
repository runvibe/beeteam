# Required usage declarations — verification (2026-10-31)

This supersedes optional-write acceptance in summary-usage-verification.md.
New createExecutionSummary bodies and close_activity.execution require non-null
usageReport with 1..32 entries. Read/transfer contracts remain compatible with
historical absence. No schema migration, backfill, collector or runtime change.

## Regression evidence

The new omission test first failed because HTTP returned 201 without usageReport.
The final cases cover omission/null/empty reports across HTTP, direct MCP and
compound MCP, atomic rollback, accepted explicit unavailable, nonblank factual
attempts, snapshot/delta deduplication, late evidence, integer bounds and totals.
An isolated SQLite legacy fixture removes metrics from a historical record and
seeds exact old request snapshots through repository APIs. Reads retain absence;
HTTP, direct MCP and compound replay return saved responses; a fresh key fails.
No current product database is used by these fixtures.

A catalog regression first failed because the generic MCP adapter discarded the
OpenAPI operation description. createExecutionSummary now publishes the detailed
source/session/model/harness/counter/baseline/unavailable instructions, and
close_activity publishes equivalent guidance.

## Validation commands

Environment: BEE_TEST_DRIVER=sqlite, OTEL_ENABLED=false.

```text
cargo test --locked --features mcp -j 1 --lib --test backend_usage
  --test backend_api --test backend_current_summary --test backend_mcp
  --test backend_overview --test backend_participants
  -- --skip sdk_tools_resources_prompts_and_atomic_compounds
  --skip backfill_preserves_existing_and_deleted_task_content_without_inference
  --skip current_summary_is_explicit_persisted_and_independent_of_description
```

The broad run passed 38 tests. After the additional catalog regression and adapter
fix, backend_usage and backend_mcp are checked again (9 + 2 tests). Together the
checks cover 39 distinct tests. The three excluded cases require PostgreSQL;
one initially failed because BEE_TEST_DATABASE_URL is absent, not because of a
functional assertion. PostgreSQL execution remains pending.

Bundled Skills source: 088f522683a68cde9255f3bcbf31856cee27da29. All 12 bundled file
hashes match provenance, retaining the local SQLite startup overlay. Global Skill
installation was handled separately by the Skills chat, not by this backend work.

Frontend creation flows must supply an explicit truthful declaration before
runtime activation. Historical display needs no fabricated metrics. Live UI and
service activation remain separate acceptance steps owned by integration.

Final cargo build --locked --features mcp -j 1 passed. Catalog regenerated with
cargo run --locked --features mcp --example mcp_catalog -j 1: 71 tools and 14
resources. Both summary tool schemas require usageReport and their exported
descriptions contain baseline/unavailable guidance. git diff --check passed.
