# Required report for each new execution summary

## Discover at the start and reuse the strategy

At the start of your work, investigate proportionately how to capture data from the correct session: tools and APIs exposed by the harness, permitted local files specific to the session, and official documentation; consult the web when you do not know the contract. Do not declare unavailability before this investigation. Record a reusable strategy with the source, observed surface/harness/version, identifiable session/actor, available fields, semantics, limitations, and verification date. Keep this operational context in the available permitted mechanism, without inventing a persistent Bee Team field or installing a collector. Reuse the strategy until a version, source, session, or semantic change requires revalidation; do not reuse an old measurement as though it were current.

A skill does not receive telemetry merely by being installed. Check the actual capability before querying. Do not install hooks, SDKs, or collectors, change settings, or start paid executions to obtain metrics. Do not read secrets, full transcripts, or other sessions. Prefer minimal counters/metadata. A model setting proves selection/configuration, not necessarily the effective model of each request; Auto, fallback, and subagents may use other models.

## Query for every new summary

Before inserting each new historical execution summary, query updated data using the validated strategy and send the required usageReport according to the actual contract, with the actual cumulative session token count up to the summary, an identified model, and verifiable harness, agent, and source. Preserve multiple models/harnesses/actors/periods when observed, with verifiable provenance. Keep the structured report separate from summary/currentSummary in Markdown; do not use comments or the sidebar as telemetry storage. A comment, standalone progress percentage, or prompt read does not require an artificial summary; every status change, however, requires recording a summary atomically with statusObserved and usageReport, including start/resumption/review.

This skill requires the actual cumulative session token count up to the summary, an identified model, harness, agent, and source before every new summary, using the current usageReport. unavailable, an explanation, and an invented number do not replace collection. Absence is not zero. If there is no reliable source or model/harness/agent/scope cannot be identified, keep the record and transition pending; save the explanation and actual attempts in a comment, confirm persistence, and notify with commentID. An actual blocker may be recorded as a separate flag according to the contract, without a shortcut status change. Do not announce a saved summary. Failure of the comment write as well requires reconciliation, without fabricating an ID or success notification.

## Semantics before accounting

Distinguish reported usage from estimates, context occupancy, credits, and cost. Do not convert context percentages or credits into exact tokens. Preserve input/output/cache categories and request/turn/session/tree scope according to the source; do not add overlapping categories. A configured model does not become an observed model by inference.

Cumulative counters are snapshots: keep appropriate baselines/epochs and derive deltas only from comparable measurements of the same source/session/scope. Reset, rotation, compaction, model changes, resumption, and retry may invalidate comparison; revalidate instead of producing a negative delta, adding snapshots, or counting a replay twice. Do not attribute cumulative session usage as task usage. Do not add tree totals and the same subagents again. Use only variants and rules accepted in the contract below; preserve the demonstrated scope without forcing exact attribution to the task. A missing initial delta does not, by itself, invalidate an actual snapshot.

## Persisting the work remains mandatory

The required report does not replace other records: description/specification, plan, historical summary, currentSummary, status, and approval remain distinct. Ending execution does not mean Completed if required human validation is pending. After confirming persistence of the summary and valid report, follow the protocol of a complete comment, persistence confirmation, and notification with commentID; do not carry details/metrics in chat. Legacy reads and replays without a report remain valid and are not backfilled by assumption.

## Confirmed contract for new summaries

Use `RecordExecution.usageReport: {entries: [...]}` in createExecutionSummary or close_activity.execution, with 1 to 32 entries. The new-write contract is SessionUsageInput, whose entries follow SessionUsageObservation; generic SummaryUsageInput/UsageObservation remain for reconciliation/history compatibility. Each observation in a NEW summary requires totalTokens, inputTokens, and outputTokens as nonnegative integer decimal strings within int64 (up to 9223372036854775807). totalTokens must be exactly inclusive inputTokens + outputTokens. Cache/reasoning are subsets, not additional components. Never invent a decomposition of an isolated total or fill an unknown component with zero. Do not create tokenUsage at the root.

New summary observations require reportKind cumulative_snapshot, scope session or session_tree, quality measured, nonempty modelId, and actor.kind agent with a persisted UUIDv7 id. The agent is metadata for the party responsible for the observation: verify the actual identity, without inferring that it is the task's executor or using human/null to bypass validation. Preserve the actual actorRole and observed harness, source, surface, sessionId, epoch, and evidenceId. A configured model or last selected model does not prove the counter's effective model. Unknown provider/version/periods/subcategories may be null according to the schema; observedAt and periods use RFC3339.

The first actual snapshot is accepted with previousEvidenceId null and delta null. totalTokens is the cumulative count up to observedAt in the source/session/epoch/actor/model scope, not exact task usage. Do not require a predecessor/delta to admit the first reading or add snapshots across summaries. Multiple disjoint sessions or models are separate entries; a mixed counter without an actual breakdown cannot be assigned the last model's name by inference. Missing source/model or actual components prohibits fabricating a report: save an impediment comment and notify, without claiming the summary/status was saved.

Each observation declares source, harness, surface, harnessVersion, sessionId, epoch, evidenceId, previousEvidenceId, actor, actorRole, provider, modelId, scope, reportKind, quality, attribution, observedAt, periodStart, periodEnd, inputTokens, outputTokens, cachedInputTokens, reasoningOutputTokens, totalTokens, and discovery. Preserve attribution according to evidence, without forcing exact; even a snapshot attributed to the agent is not exact task usage. Tree and shared/unallocated do not count as the task's exact total.

At subsequent checkpoints, follow the contract's comparability validation: an existing/earlier predecessor when provided, without forks, overlaps, negative deltas, or fictitious epochs. A reset or change of source/model/scope requires revalidating the strategy. Evidence uses source + sessionId + epoch + evidenceId: retry preserves identity/content; replay does not add usage and a content change conflicts. The persisted report has a limit of 65536 bytes and 256 entries including supplements; do not fabricate summaries to bypass limits.

unavailable, missing/empty modelId, missing totalTokens, or invalid components fail on a new write (400). Handle the error without announcing partial effects or falling back to a direct status change. Historical reads and saved replays are preserved by the service; do not rewrite them or use the exception as a shortcut for a new summary. `reconcileSummaryUsage` uses the generic schema with an optional total for legacy compatibility, appending evidence with actual taskId/summaryId and the summary's expectedVersion, without changing narrative/status; do not use it to bypass the new-summary requirement. statusObserved is a server-generated snapshot, never a field sent by the agent.

Updating skill files does not publish validation to the connected server. Check the catalog/schema and report runtime incompatibility, without silently reverting to the previous contract.

## Synthetic first-snapshot example

Do not execute or copy the IDs/values as actual evidence. The example assumes a persisted agent and an observed model with actual cumulative input 1000/output 200 up to observedAt; total 1200 belongs to the session, not the task. previousEvidenceId null is valid, without requiring a delta.

```json
{
  "usageReport": {
    "entries": [
      {
        "source": "example-session-log",
        "harness": "example-harness",
        "surface": "cli",
        "harnessVersion": null,
        "sessionId": "example-session",
        "epoch": "example-epoch",
        "evidenceId": "example-snapshot-1",
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
        "attribution": "shared",
        "observedAt": "2026-11-02T22:00:00Z",
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
  }
}
```

## Measurement origin and scope

Record the permitted strategy/provenance with the actual source, session, agent, period, scope, and counter semantics. Collect again before every summary; an old reading or model configuration does not prove current usage. A cumulative session count is not exact task usage: compare only compatible checkpoints with demonstrated coverage and attribution, without crossing resets, semantic changes, or incompatible quality or authorship. A model change prevents comparison only when the model defines the counter series; a comparable global counter may span models, preserving the models involved without an invented breakdown. If the source spans several tasks, preserve that scope and its limitation, without labeling the total as exact task usage. If even the session/actor/model or measurement is unreliable, record the impediment in a comment. The requirement is cumulative session usage, not exclusive task usage.

Cache and reasoning counters may be subsets of input/output; do not add overlapping categories, cumulative snapshots, replays, or a tree total with its own subagents. Zero is valid only when actually observed in the source. Do not convert context percentages, credits, or cost into exact tokens. Do not copy transcripts/secrets, query others' sessions, install collectors, or make paid calls to produce a number.

## Explicit execution intervals

Follow [executions and intervals](execution-intervals.md): read the active interval on resumption, record the start before working, checkpoint without closing, pause before switching, resume in a new interval, and finish independently of acceptance/final status. Preserve returned taskId/executionId/intervalId; do not infer boundaries from text/times or add snapshots/checkpoints. The payload and read contracts must be confirmed before use; session evidence and interval usage are distinct.

When an observation is selected as a boundary in executionTracking.evidenceIds, attribution must be unallocated, separating the interval ledger from legacy attribution. The generic shared example above cannot be selected as a boundary without correctly representing that role in the contract. counterMode global/per_model and coverageRootSessionId are declarations of the actual source, not mechanisms to fabricate exclusivity or split a mixed counter.
