# Get Bee Team materials in MCP

The authoritative catalog is the backend's `docs/mcp-catalog.md`/`.json`, including the validated currentSummary revision: rmcp 2.0.0, MCP 2025-11-25, Streamable HTTP. This reference documents content and packaging; it does not maintain a competing catalog. Operational instructions and examples are in [integration](integration.md), available as `beeteam://references/integration`.

## Editorial resource map — confirm current discovery

| Reference URI to confirm in resources/list | Editorial source |
|---|---|
| beeteam://skills/leader | skills/get-a-team-lead/SKILL.md |
| beeteam://skills/worker | skills/get-a-worker/SKILL.md |
| beeteam://references/integration | skills/references/integration.md |
| beeteam://references/handoff | skills/references/handoff.md |
| beeteam://references/codex | skills/references/codex.md |
| beeteam://references/team-examples | skills/get-a-team-lead/references/team-examples.md |

Use resources/list/read; unknown URIs or arbitrary filesystem access are rejected. Content is an editorial snapshot in `resources/bee-team`, without global installation. Updates in this workstream must be incorporated by the backend before appearing on the server. Do not expose validation/progress notes, secrets or files outside the allowlist. Relative links are editorial: use advertised URIs, never filesystem exploration. Discover whether this guide is advertised in the current catalog and use the returned URI, without fixing its presence/absence based on this reference.

## Implemented prompts

| Public name | Required UUIDv7 string arguments | Source |
|---|---|---|
| task_briefing | taskId | [task-briefing.md](prompts/task-briefing.md) |
| delivery_review | taskId | [delivery-review.md](prompts/delivery-review.md) |

The [manifest](prompts/content-manifest.json) keeps descriptions/arguments and names aligned with the catalog. The backend maps files to names and embeds context queried by services into a user message. prompts/get rejects missing, extra or non-text parameters, invalid IDs and nonexistent resources. Origin is derived from the chain, not an editable argument. Returned context does not authorize execution or prove nothing has changed since the query.

Example prompts/get params: `{"name":"task_briefing","arguments":{"taskId":"10000000-0000-7000-8000-000000000001"}}`. IDs are illustrative and must exist. Do not send paths/URIs in these arguments.

Resources/prompts do not execute AI or control chats. `prepare_execution` queries without starting an agent; `record_progress`/`close_activity` are atomic/idempotent mutations according to the catalog. Never announce partial success as transaction completion. The checklist derives from tasks; closing an activity may leave the task in progress. Declared authorship is not authentication and the leader editing policy remains unresolved.

## Integration and verification

Preserve the files as editorial source; do not edit snapshots in another workstream's worktree. The backend owner updates `resources/bee-team` from the delivered commit and runs actual tests of discovery, resources, prompts, allowlist security and content parity. Schema/rendering tests in this workstream do not replace protocol tests. Discover the connected server's capabilities; an older installation may lack the revision. MCP discovery pagination uses the protocol cursor; entity listings use offset/limit.

## Cumulative synthesis

All three prompts query currentSummary as cumulative state without updating it through reads. The executor recomposes it when recording progress/status/closure; `record_progress` accepts currentSummary per target and requires a nonempty value with progress; `close_activity` requires execution.currentSummary in addition to the historical summary. An always-present Task field does not make its content proof of live activity. The examples were validated against the catalog regenerated with these fields; the backend must synchronize this revision's editorial snapshots.

## Markdown specification

Prompts query Task.specification alongside the task, distinguishing requirements/acceptance from description, plan.content and currentSummary. Preparation returns specification in children as well; reading Markdown does not execute it or authorize writes. Editing through createTask/updateTask accepts an optional string, including empty for explicit clearing, but not null. The examples were validated against the catalog regenerated with specification; the backend must synchronize this commit's editorial texts.

## Slugs at the consumer entry point

resolveAgentSlug, resolveTeamSlug and resolveTaskSlug resolve readable references to `{id,slug}`. Resolve before prompts/get: all three prompts retain UUIDv7 arguments, without new slug parameters. Consult the connected catalog for current names, schemas and URIs, without relying on fixed counts. This content adds no aliases and does not generate slugs on the client.

## Operational workflows in self-contained packages

Both get-a-team-lead and get-a-worker folders contain a concise SKILL.md and references/ with complete workflows (text and Mermaid), integration, handoff, Codex, examples and templates. Local links stay within each package. Workflows derive from documents approved in commit 01e77b9; operational copies remove the historical warning that the skill does not yet apply those decisions, without claiming an updated runtime.

When synchronizing MCP, incorporate both entrypoints, workflows and their reachable references; do not publish entrypoints with inaccessible links as though workflows were available. The backend must expose this content through actually advertised resources or content aggregated into the corresponding resource, and validate discovery/reads and prompts. This workstream defines no new runtime URIs. The table above describes the previous catalog; check resources/list after updating. Briefing/resumption/review templates now preserve mandatory assignment, two confirmations and saving before notification, without changing UUID arguments or making prompts mutative.

## Status transitions

Initial status is set at creation. Every later status change (including start, resumption, review and completion) goes through summary recording with statusObserved and mandatory usageReport in the same transaction. close_activity is valid only when it records that summary through the common service; do not use updateTask/moveTask/record_progress for transitions. A percentage alone remains separately updatable with the required synthesis, without implicitly changing status. Confirm a transition only after persistence; comment/commentID, idempotency and legacy behavior remain preserved.
