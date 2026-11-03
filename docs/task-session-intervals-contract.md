# Task session intervals: implementation contract

Additive rollout: executionTracking remains optional on RecordExecution. Absence preserves an untracked summary; it never creates a boundary. Tracking shares the existing summary/status/usage transaction and idempotency key. No runtime activation in this delivery.

## Writes

executionTracking: action start|checkpoint|pause|resume|finish; executionId required except start; intervalId required for checkpoint/pause and active finish, omitted for start/resume and paused finish; evidenceIds explicitly select usageReport entries (nonempty except paused finish); reason optional (required for explicit lost-coverage recovery). Start additionally requires counterMode global|per_model and coverageRootSessionId, the actual root session identity (sessionId for a standalone session). Per-model mode is a declaration that counters are disjoint. Global mode takes exactly one counter and preserves all observed model identities without assigning its delta to the last model. All selected evidence must have attribution=unallocated; interval consumption is separate from the legacy usage attribution ledger.

The execution fixes source/harness/surface/session/scope/agent and coverage root. A source/root lock excludes actor, model, epoch and scope: tree and child flows must declare the same actual root. Source/root declarations are metadata, not authentication. No automatic child discovery or proof of exclusivity is claimed. Reuse of the same source/session cannot bypass a lock by changing agent/root. A reset or explicit gap ends comparability, retains incomplete coverage, and starts a new comparable segment; no negative or fabricated zero delta.

Response executionSummary.executionTracking: action, executionId, intervalId (nullable on paused finish), executionState active|paused|finished, intervalState open|closed|incomplete|null. Compound close_activity also returns executionSummary, retaining old response fields.

## Reads (HTTP paths and MCP operation IDs)

- GET /api/v1/tasks/{taskId}/executions: listTaskExecutions.
- GET /api/v1/tasks/{taskId}/execution-intervals: listTaskExecutionIntervals.
- GET /api/v1/tasks/{taskId}/execution-tracking-events: listTaskExecutionTrackingEvents.
- GET /api/v1/tasks/{taskId}/execution-interval-usage: getTaskExecutionIntervalUsage (complete totals, independent of pagination).
- GET /api/v1/execution-intervals: listOpenExecutionIntervals, filtered by source/sessionId/coverageRootSessionId/agentId; defaults to open for recovery across tasks.
- GET /api/v1/tasks/{taskId}/execution-intervals/{intervalId}/revisions: listTaskExecutionIntervalRevisions.

Lists use offset/limit, stable createdAt/id ordering and standard items/total/hasMore/nextOffset. Execution/interval/event rows include explicit IDs. Interval data includes startSummaryId/endSummaryId, startObservedAt/endObservedAt, startReceivedAt/endReceivedAt, counters with immutable evidence snapshots and segment calculations, models, totalTokens nullable, partialTokens nullable, observedDurationMs nullable, coverage/reason, revision. Events include action, summaryId, statusObserved, reportingActor, observedAt and receivedAt. Never join by time proximity.

Aggregate: validTotalTokens (nullable), partialTotalTokens (nullable), observedDurationMs (sum of closed measured intervals), elapsedDurationMs (union of closed observed ranges), coverage {totalIntervals,validIntervals,openIntervals,incompleteIntervals,invalidIntervals,untrackedSummaries}. Values are decimal strings; absence is null, real measured zero is "0". Task totals exclude open/incomplete/invalid intervals; their known parts are separately partial.

## Reconciliation

POST /api/v1/tasks/{taskId}/execution-intervals/{intervalId}/revisions (reconcileTaskExecutionInterval) explicitly references start/end evidence via {summaryId,evidenceId}, carries reason and expectedVersion, preserves old interval/counter calculation in immutable revision history. Correction never mutates original evidence or summaries and never silently reopens a closed interval. Lost coverage can be explicitly invalidated; original displayed results remain auditable. Recomputed boundaries must preserve execution identity and non-overlap.

Relational tables follow the existing resource payload plus generated FK/index columns pattern in independent SQLite/PG migrations. The existing serialized UnitOfWork remains responsible for writes; reads use bounded SQL filtering/pagination and streaming aggregation inside read-only snapshots.

## Final clarifications

Paused finish still supplies the normal required measured usageReport but evidenceIds is empty; those usage observations never become a paused-work boundary. evidenceIds contains observation.evidenceId strings, resolved uniquely in that summary request. All per-model counters at a boundary share observedAt. coverageLost:true requires a factual nonblank reason on checkpoint/pause/active finish; it stops comparability and opens a fresh segment, preserving incomplete coverage. Repeated evidence cannot establish a lost-coverage boundary. A missing series also interrupts that series when it returns.

If-Match/expectedVersion refers to the task for summary actions (including close_activity) and to the interval for reconciliation. Execution IDs and interval IDs are immutable. Counter mode and coverage root are only supplied on start. Reconciliation startEvidence/endEvidence are arrays of {summaryId,evidenceId}; original evidence is immutable. Current interval includes its current calculation; revisions list earlier calculation snapshots. Event evidence is an array named `evidence`, containing UsageEntry objects with observation.totalTokens, not an independently summed event total. Duration strings use observed milliseconds; this is wall-clock evidence coverage, not CPU or productive work.
