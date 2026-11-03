# Required usage declarations in new execution summaries

This increment implements structured usage reports in historical
execution summaries and task Overview. It does not install collectors, activate
harnesses, read credentials or write product/demo metrics.

## Current new-summary contract — 2026-11-02

The user chose the **real cumulative session total**, not mandatory task-exclusive
delta consumption. Every new RecordExecution.usageReport.entries observation must
be measured cumulative_snapshot with scope session/session_tree, an identified
nonblank modelId and actor kind agent with a persisted UUIDv7. inputTokens,
outputTokens and the new totalTokens are non-null canonical decimal integer strings
bounded by signed int64; totalTokens must equal inclusive inputTokens + outputTokens.
Cache/reasoning are subsets, never added again. A measured zero is valid, an absent
measurement is not zero. Unknown model, unavailable, estimated or request-only usage
cannot satisfy a new summary. Collection failure returns actionable invalid_request
(HTTP400) and rolls back the summary/status/compound changes. Use a comment for the
impediment without inventing telemetry or claiming summary persistence.

The total is a snapshot of its source/session/epoch/actor/model counter through
observedAt, from that counter's real reset/start. periodStart/periodEnd can remain
null when the source does not provide wall-clock boundaries; never fabricate them.
A valid first snapshot has previousEvidenceId null and delta null and **is accepted**.
It records the supplied cumulative total without creating inferred historical task
consumption. Comparable later snapshots use the latest predecessor; intentional
reset/gap baselines remain explicit. Repeated identical evidence is a reference,
not extra consumption. Adding totalTokens to an already recorded observation changes
its content: do not reuse the same evidence identity with different content; exact
saved request replays remain unchanged.

Multiple sessions/models are separate disjoint counter observations. Never label a
mixed-model counter with the last selected model, sum successive snapshots, mix a
whole-tree counter with its children, or add model totals to the same aggregate.
If the source cannot establish the model/counter scope, collection is insufficient.
Session and session_tree are distinct; tree evidence never becomes exact task use.
Attribution exact/shared/unallocated remains declared evidence, not inferred from
this new numeric field. The server checks syntax, actor existence, sums and ledger
consistency; it cannot attest that client-reported telemetry came from a provider.

Reads and late-evidence reconciliation retain the general UsageObservation schema,
where totalTokens is optional for historical data. RecordExecution uses the stricter
SessionUsageInput/SessionUsageObservation. Existing report/delta/revision semantics
below are unchanged. No backfill, migration, or reinterpretation of old reports.
Saved HTTP/MCP/close_activity POST replays run before new-write validation.

Collector capabilities and limits are documented in [harness sources](harness-token-sources.md).
This change does not install collectors, access private logs or restart services.

## Earlier contract and ledger semantics (superseded for new-write eligibility)

The following sections describe the original report representation and ledger.
Statements allowing unavailable/partial-only new summaries are superseded by the
current contract above; they still explain historical and late-evidence reads.

## Writes and compatibility

`createExecutionSummary` and `close_activity.execution` require a non-null
`usageReport: {entries: [...]}` with 1..32 entries on every new write. Omission,
null and an empty list fail with an actionable 400 error. The Markdown
`summary`, cumulative `currentSummary`, execution outcome and explicit status
remain independent. No summary or status transition is created just to report
usage. New summaries retain `statusObserved: {id,name,isDone}`; old summaries
without it remain absent/null in read projections, never inferred from today's
status name. Reporting actor and each usage actor can differ.

Each entry follows `UsageObservation` in the OpenAPI, including source, harness,
surface/version, logical session, epoch, stable evidence ID, actor/role, nullable
provider/model, observation/period times, scope, kind, quality and attribution.
Unknown model/provider/categories use null. Names are not a hardcoded catalog.
No raw transcript, prompt, credentials or file content belongs in an observation.

Counters are decimal integer **strings**, or null, bounded by signed 64-bit
integers. Input and output are inclusive totals; cached input and reasoning
output are subsets. These subsets are never added again. Zero means observed
zero. Missing means unknown. A partial input/output measurement can be retained
without inventing a total. An unavailable entry needs all four counters null, quality unavailable and
factual `discovery: {reason,attempts}` with a nonblank reason and nonblank attempts.
When collection is impossible, this explicit declaration allows the summary to
be saved; silently omitting the report does not.

The actor union is human/null or agent/persisted UUIDv7. Actor metadata is
declared, not authentication. A historical role is captured in each observation
and does not follow later profile changes.

## Evidence and accounting

- `period_delta` is limited to **request** scope with a stable source request
  evidence ID and no predecessor. It is already a delta; do not subtract again.
- `cumulative_snapshot` supports session/session_tree scope. The first sample is
  a baseline and contributes no inferred historical consumption. A later sample
  names `previousEvidenceId`, already present in the same source/session/epoch,
  actor, harness, scope, provider and model, with strictly earlier observedAt.
- This increment advances the latest checkpoint in each counter scope. A new
  baseline may mark a gap, but later deltas cannot branch around it. Out-of-order
  historical snapshots are rejected rather than inserted into an already counted
  interval. Harness version, quality and attribution must remain comparable;
  otherwise establish a new baseline instead of labeling an estimated difference
  as measured.
- A predecessor can have one successor. Negative deltas, forks, crossing tasks,
  and mixing request/cumulative or aggregate/per-model counters are rejected.
  For a session/epoch/actor, choose one canonical source rather than add a log
  and SDK stream covering the same work. Source identifiers remain client
  evidence: the server cannot prove that two unrelated external session aliases
  refer to the same physical execution. Skills must investigate that mapping.
- Evidence identity is source + sessionId + epoch + evidenceId, independent of
  the reporting summary/actor/model. Repeating identical evidence in another
  summary creates a reference (`counted=false`), not more consumption. Reusing
  the identity with changed content conflicts; allocating it to another task
  conflicts. An epoch must identify a real counter reset, not a way to bypass
  deduplication.
- Only exact, non-tree canonical deltas contribute to task totals. Shared,
  unallocated and tree measurements stay visible as evidence outside the task
  total. Measured and estimated totals are separate. Unknown model remains null;
  a mixed counter must not be relabeled with the last selected model.

Example arithmetic: snapshots input/output 1000/100 then 1300/160 produce a
known delta 300/60, total360. They never produce total2300 or1460. If coverage
before the baseline is unknown, the task total is explicitly partial. Multiple
actors' disjoint known contributions accumulate; the last actor does not replace
the task total.

## Late evidence

`POST /api/v1/tasks/{taskId}/execution-summaries/{summaryId}/usage-revisions`
and MCP `reconcileSummaryUsage` append entries to an existing summary report.
The body is `SummaryUsageInput`; HTTP If-Match / MCP expectedVersion is the
**execution summary version**, not the task version. Actor and idempotency key
are required by the usual mutation envelope. Summary responses now expose an
optional version for legacy compatibility.

Reconciliation preserves the Markdown, statusObserved, original report and
earlier entries. It increments report revision and summary version, adds entry
reportRevision/reportedAt/reportingActor, and sets reconciledAt for supplements
to an existing report. It does not touch task version/status/currentSummary or
create a new summary/comment. Existing saved replay responses remain exact even
after reconciliation. A failed compound write rolls back comments, summary,
task changes and usage together.

There are at most32 entries per request and256 per summary including supplements;
the complete persisted report is capped at65536 UTF-8 bytes. Exhausting that
bound requires a subsequent genuine work summary, not unlimited supplements.

## Reads

Overview adds `usage: TaskUsage`. The same read model is available through
`GET /api/v1/tasks/{taskId}/usage` / MCP `getTaskUsage`, with offset/limit for
summary checkpoints. It contains:

- `knownTotalTokens`: exact measured known total, null if none is known;
  `estimatedTotalTokens` is separate. `measuredComponents` preserves partially
  known categories. Totals derive from all canonical evidence, not a page.
- Coverage counts: total/reported/missing summaries, entries by quality,
  unavailable, baseline, duplicate and unallocated entries. These are counts of
  records, not a percentage of actual tokens captured or proof of completeness.
- Distinct reported `models` and `harnesses`, each capped at100 with total and
  truncated. `GET /api/v1/tasks/{taskId}/usage/dimensions?kind=model|harness`
  / MCP `listTaskUsageDimensions` pages through the complete set with offset/limit.
- Timeline of **all** execution summaries, including ones without metrics,
  ordered by summary createdAt/id descending. `reportedAt` on a timeline item is
  the summary registration time, not an asserted time of model consumption.
  Each item links summaryId, reportingActor, statusObserved and optional report.
  Entry observedAt/period and later report timestamps are available separately.

The default presentation is summary metadata + Overview total, models/harnesses
and checkpoint timeline. There is no usage sidebar or default comment telemetry.
Lists may include a reported model whose usage is unavailable/estimated; this is
not proof of measured consumption for that model. UI must retain that provenance.

## Persistence boundary

Evidence and derived canonical segments are immutable entries inside the
existing `execution_summaries.data.usageReport`; late reports append entries.
Independent PostgreSQL/SQLite migrations add a task-scoped SQL view and partial
index. This avoids introducing new transfer tables or changing archive format:
the existing raw-document transfer mechanism retains the fields verbatim.
No transfer/cancellation/restore workflow is modified.

SQL aggregates and paginated reads execute in one repository-owned read-only
snapshot. No global read preload or write lock was added. Writes use the existing
serialized UnitOfWork; source identity checks are service policy under that
serialization. Changes are composed in services and DTO validation is shared
between HTTP and MCP.

This is a scoped implementation of the broader plan. Standalone collectors,
automatic background reconciliation, global usage dashboards, monetary costs,
general session/binding management and automatic backfill remain outside this
delivery. A source without enough evidence must be explicitly unavailable; it is never
replaced with fabricated historical consumption.

## Required-write upgrade (2026-10-31)

Discover permitted sources and the correct session at work start, and refresh
evidence for each report. Record actual harness/surface and models used, never a
current global selection substituted for history. Unknown provider/model/version
remain null. Measured/estimated entries require at least one known input or output
component; unknown components stay null. When session/epoch cannot be observed,
use the explicit `unavailable` sentinel and a unique evidenceId identifying the
reporting attempt (stable on retry), not an invented execution session. Explain
unknown harness/surface with `unknown` and a factual discovery reason. The server
validates structure, not the factual truth of client-declared discovery attempts.

Read schemas, stored historical summaries and portable raw transfer stay compatible
with absent reports. No data migration or backfill is performed. Exact saved
idempotent responses are looked up before the new required-write validation in
both ordinary and compound services. A new idempotency key is a new write and
must satisfy the required report contract.

## Recorded session consumption (additive read model)

`TaskUsage.recordedSessionUsage` exposes measuredTotalTokens and
estimatedTotalTokens separately from task-attributed knownTotalTokens and
estimatedTotalTokens. It sums only already stored canonical deltas for
cumulative_snapshot with scope=session, including shared/unallocated evidence.
It never changes attribution, adds raw snapshots, or includes request/session_tree
counters. It overlaps task-attributed session evidence and MUST NOT be added to
the existing attributed totals. Null means no complete known delta total; a
measured zero remains the string "0". Numeric strings retain 128-bit aggregate
precision, including totals beyond int64. Original per-entry bounds are unchanged.

Coverage gives distinct source/sessionId pairs among canonical entries in sessions, canonical baselineEntries
and deltaEntries, and excluded duplicateEntries. Epoch resets can add baselines
within one session. Duplicate evidence keys/references and appended repeated
observations never add consumption. Sources/session aliases are declared provenance;
the API cannot prove that two different external IDs cover the same physical work.

Every SummaryUsageTimelineItem also includes recordedSessionUsage calculated from
that summary's current report entries. The frontend can draw one delta point per
summary without implementing accounting rules. Baselines and duplicate-only summaries
have null totals and retain their informational snapshots in usageReport.entries.
Missing legacy reports yield null totals/empty coverage, never fabricated zero.
Both fields are optional in schema for legacy responses and present in current reads.

The global aggregate covers all pages in the same read snapshot; per-summary
aggregates cover only their report, including later supplements. Timeline reportedAt
is the summary registration time, not necessarily when evidence was observed or
reconciled. Entry observedAt, reportRevision, reportingActor and reconciledAt retain
that distinction. statusObserved is historical; reportingActor and observation.actor
identify authors/evidence actors. No historical task executor is inferred from the
current executor. Graphs must preserve gaps and expose evidence provenance.

Repositories stream task-filtered stored session entries inside the existing read
snapshot; no global resource preload, write, migration or backfill is introduced.

## Recorded session verification — 2026-11-02

- `BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test --locked --lib --test backend_usage --test backend_overview --test backend_mcp -j1 -- --skip sdk_tools_resources_prompts_and_atomic_compounds`: 40 passed (26 library, 10 usage, 2 overview, 2 MCP).
- Isolated regression reproduces measured delta 1186039 while task-attributed total stays null; covers baseline pagination, repeated observations/revisions, a second estimated session, Overview and HTTP/MCP parity.
- Unit coverage checks aggregates beyond int64, canonical evidence deduplication, excluded scopes, unknown totals and observed zero.
- `cargo build --locked --features mcp -j1` passed; MCP catalog regenerated with the documented command.
- PostgreSQL runtime tests remain pending: no isolated BEE_TEST_DATABASE_URL configured; the PostgreSQL-only MCP SDK test was explicitly filtered out. Both repository adapters compiled.
- No product database changes, backfill, service restart or runtime activation were performed.
