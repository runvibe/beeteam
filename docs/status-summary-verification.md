# Summary-only status transitions — 2026-11-02

## Contract and audit

- createTask retains explicit/default initial non-final status. updateTask already rejects statusId via the shared DTO schema (even unchanged); record_progress also excludes it.
- moveTask was the non-final transition bypass. Its shared service now rejects every different target status with summary_required (HTTP 409) before any position or task write, including when currentSummary is supplied. Same-status reordering remains permitted, including final status.
- createExecutionSummary owns status mutation and captures destination id/name/isDone as statusObserved in the same UnitOfWork as the summary and usage report. close_activity invokes that service within its existing transaction; errors roll back comments, blocks and all task changes.
- Independent percentage/progress updates retain existing validation. Actor context, assignment checks, version checks and idempotency flow were not changed.
- POST saved responses are replayed before current validation; PUT position has no persisted replay mechanism. Existing records are neither migrated nor backfilled.
- statusObserved is server-owned historical data, not a join to current status. Tests rename the status, move the task again, append usage evidence, then verify the original snapshot remains unchanged. The frontend summary graph can use timeline.reportedAt/statusObserved/reportingActor/recordedSessionUsage.

## Validation

The new bypass regression failed before implementation (HTTP 200 instead of 409).
Final command, with BEE_TEST_DRIVER=sqlite and OTEL_ENABLED=false:

```powershell
cargo test --locked --lib --test backend_status_summaries --test backend_board_subtasks --test backend_api --test backend_usage --test backend_overview --test backend_mcp --test backend_current_summary -j1 -- --skip sdk_tools_resources_prompts_and_atomic_compounds --skip current_summary_is_explicit_persisted_and_independent_of_description --skip backfill_preserves_existing_and_deleted_task_content_without_inference
```

48 tests passed: 26 library, 2 API, 1 board subtasks, 1 contract examples,
2 MCP, 2 Overview, 4 status-summary and 10 usage tests. Coverage includes HTTP/MCP
bypass rejection with no writes, same-status summaries/reordering, initial status,
independent progress, atomic rollback, current and saved legacy POST replays,
historical snapshots after rename/reconciliation and child independence.

The three explicitly excluded tests require isolated PostgreSQL; BEE_TEST_DATABASE_URL
was not configured. Their targets compiled, but PostgreSQL runtime validation is pending.
An intermediate run attempted the PG-only backfill test and failed on the missing
variable; it did not connect to a database. The final command excludes all three.

cargo build --locked --features mcp -j1 passed. MCP catalog regenerated using
cargo run --locked --features mcp --example mcp_catalog -j1: 71 tools, 15 resources,
3 prompts. Source/bundle SHA256 checks passed for all 13 provenance files; git diff
--check passed. Bundled Skills source is 4d81ec1d6513fc4d67dc3b0186a6ef9b63e9b367,
with existing SQLite/bootstrap overlays retained.

## Integration boundary

Frontend was informed of HTTP409 summary_required versus PATCH HTTP400 invalid_request;
its owner reported no existing live caller that moves task status. Skills guidance
and examples were synchronized in existing bundled resources. No service was restarted,
no real data changed, and no runtime acceptance is claimed by this commit.
