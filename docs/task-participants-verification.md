# Task participant lookup — 2026-10-30

## Scope and contract

`GET /api/v1/tasks/{taskId}/participants` / MCP `listTaskParticipants` accepts taskId and optional offset/limit (default 50, maximum 100). Returns a page of `{actorKind, actorId, agentName, agentArchived, agentDeleted}`. Nullable actorId/agentName are explicit. Frontend agreed to load this participant page collection rather than global agents or comment pages.

The repository aggregates exactly this task's current author/executor, non-deleted authorship records in comments, plan_revisions, attachments, execution_summaries and events, plus author/executor from creation events and previous/current executor from assignment events. Retained events preserve past participation after an attachment is removed. It excludes other tasks, children and unrelated teammates. Humans aggregate into a single null-ID entry without invented identity. Names and archive/delete flags come from current agent metadata; no historical profile name or role is invented.

Queries bind task ID, limit and offset. Count and page run inside the existing read-only snapshot. Distinct actorKind/actorId pairs are ordered before pagination. No schema migration or mutation is involved. listComments.actorId now filters recorded author IDs without requiring a surviving profile (valid unknown UUID gives an empty page), so historical participants remain selectable.

## Operational boundary

The user-started API process PID 14064 uses target/debug/beeteam.exe. Standard cargo build/test reached an OS access-denied failure when Cargo attempted to replace that running executable; no process was stopped or replaced. cargo build --locked --features mcp --lib -j 1 passed. Release validation uses the isolated .local/distribution/port-target directory, not the active executable. The PostgreSQL test endpoint on 55481 remains unavailable. Runtime activation remains separate/manual.

## Coverage

The HTTP/MCP integration test covers all participation categories, duplicate authors, an old executor, an archived author, a removed attachment with retained history, anonymous human grouping, other-task/child exclusion, empty comment search independent of participants, 2-item participant pages with filtered total and stable order, out-of-range offset, missing task, unsupported text filter, unknown valid author ID and unchanged task state after reads.

## Results

- `cargo build --locked --features mcp --lib -j 1`: passed (including final source).
- Standard binary build and integration-test invocation could not replace the actively running target/debug/beeteam.exe (Windows OS error 5). The existing process was not stopped, renamed or overwritten.
- `cargo test --locked --release --features mcp -j 1 --lib --test backend_participants` with BEE_TEST_DRIVER=sqlite and CARGO_TARGET_DIR=.local/distribution/port-target: 21 unit tests plus the new HTTP/MCP integration test passed. The focused test includes the final unknown-author empty-page behavior.
- The previous debug integration executable also passed the participant scope test. No claim is made that the complete integration suite passed on this change; PostgreSQL remains unavailable, and the ordinary debug binary path is occupied by the product process.
- Catalog regenerated through `cargo run --locked --features mcp --example mcp_catalog`: 67 tools, including read-only listTaskParticipants; resource/prompt contracts unchanged.
- Read-only live inspection after implementation: API health OK, 66 active tools, listTaskParticipants not active. New code requires separately coordinated activation; no runtime change was attempted.
