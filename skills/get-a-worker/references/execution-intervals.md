# Explicit executions and intervals per task

## Start before working

Before performing work on the assigned task, consult the task's and source/session's execution/interval records through the reads actually advertised in the contract. When resuming a chat, retrieve the active interval before creating another. If the same task/source already has a valid open interval, continue with the existing executionId/intervalId: do not issue another start or resume. Resume is for a paused execution, not merely reopening a chat. taskId, executionId, and intervalId are technical links returned by the server: keep them in the permitted context and retrieve them from the API when missing. Do not infer IDs, boundary pairs, or state from summary text, status, name, proximity of timestamps, or chat title.

Investigate the permitted source of cumulative counts at the start; preserve source, session, epoch, scope, counter semantics, agent, and model(s). Collect before every boundary and summary. Do not convert credits/context into tokens, install collectors/integrations, or make paid calls solely to measure without specific authorization. A new session per task is not required.

If there is no incompatible active interval and the work is authorized/assigned/prepared, record a start summary with actual evidence and a start action according to the contract. Begin only after confirming persistence and obtaining actual executionId/intervalId. If an interval from the same source is already open on another task, do not open an overlapping one or automatically close the previous one; inspect the conflict and resolve the transition explicitly. Changing agents does not bypass source exclusivity.

## Checkpoint, switching, resumption, and finish

Checkpoint records new evidence/summary in the open interval, preserving its start; it does not create a new interval or declare a finish. Partial is partial, not final usage. Never add intermediate deltas to the final delta.

Before switching tasks, collect and save a pause or closure of the current interval, referencing its IDs. Open the next task's interval only after confirmation. Pause closes the interval and keeps the execution paused. Resume opens a new interval in the same execution with a new initial boundary; the paused period is excluded from attributed usage. Do not reuse a closed intervalId as a new interval.

Finish ends the execution and closes the open interval; when already paused, it does not invent usage for the paused period. In that case, still send a normal strict usageReport in the summary, with empty evidenceIds and no intervalId; the observations create neither a boundary nor usage for the paused period. Finishing an interval/execution does not mean approving the deliverable or completing the task status: human review may remain pending. Preserve status, outcome, currentSummary, summary, and acceptance as distinct dimensions.

Status changes continue exclusively through summary recording, with usageReport and server-generated statusObserved. In the additive rollout, executionTracking is optional on the server: its absence saves a summary without tracking and never creates an implicit boundary. This skill directs tracking new work when the capability is available; do not claim an interval was saved in a summary without tracking or treat API optionality as an automatic boundary. Summary, status, evidence, and interval transition must be atomic and idempotent. close_activity may be used only when the contract supports that same complete operation; a standalone percentage and a comment remain separate paths, without implicitly starting/closing an interval.

## Evidence, calculation, and limits

Cumulative session usage differs from usage attributed to an interval. The server calculates final - initial only between explicitly linked, comparable evidence. Exclusive dedication to a task is the agent's declaration, not proof produced by counters. Usage up to final collection does not cover subsequent generation or calls; the same limitation applies to the message/tool used to record the start. Do not promise per-call precision when only snapshots exist.

Do not add checkpoints, a tree with its children, a global total with its components, or pairs selected by time. Source/session/epoch/scope and semantics must match. A model change does not prove a global counter reset: preserve the models involved and split usage only if the source provides truly disjoint series. Do not attribute everything to the last model or invent a breakdown.

A reset, counter decrease, gap, or incompatible source produces incomplete/unavailable coverage with a reason; never a negative delta or fabricated zero. Without a finish, the interval remains open; without a start, history remains readable without invented retroactive usage. Do not reconstruct legacy intervals from status, text, or time. Correction/reconciliation requires an auditable trail and version according to the contract, not silent boundary edits.

Observed duration is the difference between evidence timestamps, not CPU/reasoning/productivity. Summed work duration and task elapsed time differ, especially with parallel sessions; do not sum overlaps and call it elapsed time.

## Failures and resumption

Collection failure: save an impediment comment with actual attempts, confirm persistence, and notify via task/commentID. Do not invent a measurement or claim a saved pause/finish/summary; the interval remains open/incomplete until explicit correction. An agent crash does not automatically close an interval. Recovery queries actual state and lost coverage before recording a supported action.

On timeout, consult records and reuse the idempotency key/content when appropriate, retrieving the same IDs. In a conflict with another task/session/agent or a concurrent start, do not substitute IDs or blindly repeat creation. An error does not authorize claiming partial effects or a status change. A complete comment and reference notification after persistence remain required; executionId/intervalId are not commentID.

## Write and read contract

Contract aligned with the Backend; confirm availability/schema in the connected runtime before sending a payload. RecordExecution.executionTracking is optional in the rollout and shares the transaction/idempotency key with summary/status/usage. Actions: start, checkpoint, pause, resume, finish. executionId is required after start; intervalId is required for active checkpoint/pause/finish and omitted for start/resume/already paused finish. evidenceIds explicitly selects usageReport entries, nonempty except for a paused finish. evidenceIds contains observation.evidenceId strings, resolved exactly within the same call's usageReport. reason is optional; coverageLost true requires a nonempty reason and applies only to active checkpoint/pause/finish: it ends comparability and opens a segment with the new evidence, preserving incomplete closure. Do not use it to invent recovered coverage.

Start requires counterMode global or per_model and coverageRootSessionId: the actual root session identity (sessionId for an isolated session). global selects exactly one counter; a model change preserves the models involved without attributing the delta to the last one. per_model declares actual disjoint series, not an estimated breakdown. Selected evidence has attribution unallocated to avoid duplicate attribution in the legacy ledger. Do not alter observed counters/models to satisfy the mode or requirements.

An execution fixes source/harness/surface/session/scope/agent and the coverage root. The source/root lock does not depend on agent/model/epoch/scope; a tree and its children declare the same actual root. Do not change root, agent, or epoch to bypass an open interval. Metadata is neither authentication nor proof of exclusivity; the server does not discover children automatically. A reset/gap ends comparability with incomplete coverage and a new segment according to the supported operation.

The response includes executionSummary.executionTracking with action, executionId, intervalId (null for a paused finish), executionState active/paused/finished, and intervalState open/closed/incomplete/null. close_activity also returns executionSummary, preserving previous fields. Keep the exact IDs from this result; for a direct response, consult the actual envelope instead of inventing a path. Replays preserve IDs/result. expectedVersion/If-Match in summary actions and close_activity belongs to the task; in reconciliation it is the interval version. Do not use executionId as a version or confuse version with revision.

Advertised reads (check the catalog and params/query envelopes before calling):

| Need | HTTP GET | MCP operation |
| --- | --- | --- |
| Task executions | /api/v2/tasks/{taskId}/executions | listTaskExecutions |
| Task intervals | /api/v2/tasks/{taskId}/execution-intervals | listTaskExecutionIntervals |
| Explicit events | /api/v2/tasks/{taskId}/execution-tracking-events | listTaskExecutionTrackingEvents |
| Complete total, independent of the page | /api/v2/tasks/{taskId}/execution-interval-usage | getTaskExecutionIntervalUsage |
| Open intervals across tasks | /api/v2/execution-intervals | listOpenExecutionIntervals |
| Auditable revisions | /api/v2/tasks/{taskId}/execution-intervals/{intervalId}/revisions | listTaskExecutionIntervalRevisions |

The global query uses source/sessionId/coverageRootSessionId/agentId and returns open intervals by default. listTaskExecutions filters state; listTaskExecutionIntervals filters state/executionId. Lists and revisions accept offset/limit; events and totals use the parameters advertised in the catalog, without invented filters. To detect overlap, do not restrict the search to your own agent if that would hide the same source in use by another. Paginate offset/limit with items/total/hasMore/nextOffset; IDs and startSummaryId/endSummaryId provide links, not timestamps. Also keep evidence IDs and confirmed boundary coverage.

Totals: validTotalTokens excludes open/incomplete/invalid intervals; known portions go into partialTotalTokens. Durations observedDurationMs (sum) and elapsedDurationMs (union of closed periods) are distinct. Values are decimal strings; absence is null, actual zero is "0". Use the complete aggregate, do not sum only the listed page. coverage includes counts of valid, open, incomplete, invalid intervals and untracked summaries.

reconcileTaskExecutionInterval corresponds to POST /api/v2/tasks/{taskId}/execution-intervals/{intervalId}/revisions: it references boundaries by summaryId/evidenceId, reason, and expectedVersion, preserving the previous revision. The ReconcileExecutionInterval body accepts reason, invalidate, startEvidence, and endEvidence; boundaries are arrays of {summaryId,evidenceId}, if provided. expectedVersion belongs in the envelope/If-Match, not the body. Check the catalog before sending. Correction does not change the original evidence/summary or silently reopen a closed interval; it preserves identity/non-overlap. Lost coverage does not become zero or presumed backfill.

## Sequence examples (without invented payloads)

Start: collect an actual snapshot; select its evidence with attribution unallocated, counterMode matching the source, and the actual root; send a summary with start; confirm executionId/intervalId before working. Checkpoint: send active IDs and new evidence without closing. Pause: collect a boundary and close the active interval before switching. Resume: same executionId, without the old intervalId; new initial evidence and a new returned intervalId. Active finish: executionId/intervalId and final boundary; paused finish: executionId without intervalId and without inventing paused-period evidence. A paused finish still requires a normal strict usageReport, but empty evidenceIds creates no new boundary. In every case, required summary fields and the task version remain required.

Resumption: query listOpenExecutionIntervals and task records; if there is a valid active interval for the same task/source, continue with its IDs, without a new start/resume. If the source is occupied by another task, handle the conflict and explicitly close/pause only when authorized, without automatic closure. Collection failure keeps the interval open/incomplete and produces an impediment comment/notification, never a fictitious summary/finish. Obtaining prompts remains a read, without executing these sequences.

Conceptual scenario, without an API call: A starts at 1000 and pauses at 1300; B uses the session; A resumes at 2000 and finishes at 2200. A has two intervals and 300+200=500, not 1200. In another sequence, A closes at 1600 and B opens at 1650: the 50 between boundaries belongs to no task. These numbers are not actual evidence and must not be sent to the server.

## Synthetic body examples and fragments

Do not execute these examples or copy IDs, names, counters, or sources into actual records. The first JSON declares false/an empty list because the start example reports no commit; do not copy that declaration if a commit occurred in the actual work. The first JSON is only RecordExecution (the body of createExecutionSummary or the execution value in close_activity), not the actor/version/idempotency envelope. taskId remains in the path/params; executionContext preserves the actual root/origin. The other JSONs show only the executionTracking property: complete the rest of the summary and a valid usageReport, with each selected evidenceId present in that call. Execution/interval UUIDs must come from the actual response, never these synthetic placeholders.

```json
{
  "currentSummary": "Synthetic example: preparation completed; start awaiting confirmation.",
  "summary": "Synthetic example of an initial boundary.",
  "outcome": "progress",
  "statusId": "10000000-0000-7000-8000-000000000003",
  "deliverables": [],
  "pending": [
    "Execute only after confirming the start"
  ],
  "executionContext": {
    "rootTaskId": "10000000-0000-7000-8000-000000000001",
    "originBoardId": "10000000-0000-7000-8000-000000000004"
  },
  "usageReport": {
    "entries": [
      {
        "source": "example-session-log",
        "harness": "example-harness",
        "surface": "cli",
        "harnessVersion": null,
        "sessionId": "example-session",
        "epoch": "example-epoch",
        "evidenceId": "example-start",
        "previousEvidenceId": null,
        "actor": {
          "kind": "agent",
          "id": "10000000-0000-7000-8000-000000000002"
        },
        "actorRole": "worker",
        "provider": "example-provider",
        "modelId": "example-observed-model",
        "scope": "session",
        "reportKind": "cumulative_snapshot",
        "quality": "measured",
        "attribution": "unallocated",
        "observedAt": "2026-11-03T10:00:00Z",
        "periodStart": null,
        "periodEnd": null,
        "inputTokens": "1000",
        "outputTokens": "200",
        "cachedInputTokens": null,
        "reasoningOutputTokens": null,
        "totalTokens": "1200",
        "discovery": null
      }
    ]
  },
  "executionTracking": {
    "action": "start",
    "evidenceIds": [
      "example-start"
    ],
    "counterMode": "global",
    "coverageRootSessionId": "example-session"
  },
  "commitReport": {
    "hasCommits": false,
    "commits": []
  }
}
```

Checkpoint without closing:

```json
{
  "executionTracking": {
    "action": "checkpoint",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-checkpoint"
    ]
  }
}
```

Pause before switching tasks:

```json
{
  "executionTracking": {
    "action": "pause",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-pause"
    ]
  }
}
```

Resumption: a new intervalId will be returned:

```json
{
  "executionTracking": {
    "action": "resume",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "evidenceIds": [
      "example-resume"
    ]
  }
}
```

Active finish, independent of acceptance/final status:

```json
{
  "executionTracking": {
    "action": "finish",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-finish"
    ]
  }
}
```

Already paused finish: usageReport remains required, without an additional boundary:

```json
{
  "executionTracking": {
    "action": "finish",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "evidenceIds": []
  }
}
```

Checkpoint with an explicitly declared gap; does not fill lost coverage:

```json
{
  "executionTracking": {
    "action": "checkpoint",
    "executionId": "10000000-0000-7000-8000-000000000005",
    "intervalId": "10000000-0000-7000-8000-000000000006",
    "evidenceIds": [
      "example-after-gap"
    ],
    "coverageLost": true,
    "reason": "Synthetic example: interval without a verifiable observation before this evidence."
  }
}
```
