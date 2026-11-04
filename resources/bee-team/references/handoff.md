# Briefing and closure


## Leader is the human interface for the work

Outside the initial bootstrap of a new Collaborator chat and its setup response, every work interaction initiated by the Collaborator toward the human goes through the Leader: questions, choices, confirmations, requests, decisions, and substantive reports. Do not use direct dialogue with the user or harness interactive dialogs (such as `request_user_input`, `request_user_input_async` in Codex, or equivalents) as a work channel. Save the complete content in a task comment; for a question, formulate a clear question and alternatives if useful; notify the Leader only with taskID, updated areas, relevant status, and the returned commentID. Wait for a persisted response and read the indicated comment through MCP before acting on it.

The recording rule and absence of interactive dialogs also apply to the Leader in every substantive task-related interaction. When a human decision is needed, the Leader records the complete question/options in a task comment and notifies the user only with the task, areas actually updated, relevant status, and commentID, without `request_user_input`, `request_user_input_async`, or equivalents. Wait for an authorized response. Spontaneous responses and legitimate human instructions in chat remain valid: the Leader persists the response/decision in the task before acting or delegating. There is no Leader above the Leader and no circular forwarding. To respond to the Collaborator, read the comment/state, persist the response, and notify using the same metadata. The Collaborator records a blocker only if the question prevents continuation and continues independent parts already authorized. This does not bypass or suppress mandatory harness tool/security approvals; controls imposed by the system/harness take precedence and are not communication exceptions chosen by the agent. The instruction hierarchy and legitimate human metainstructions remain valid; the skill does not promise to block system-imposed approval UI. If a task, Leader, or identity is missing, wait for setup, without creating self-authorization, inventing commentID, or opening alternative dialogue. The only communication exception is the bootstrap of a new Collaborator chat: the Leader's initial request (skill/identity/team) and a response limited to setup, actual name, confirmed IDs, and readiness or a bootstrap impediment; no business work.


## Task and comment as the source of truth between agents

Every Leader→Collaborator work request requires a recorded and assigned task/subtask before requesting execution. Every interaction/notification requires a complete comment and commentID, including a status-only update. The only communication exception is the bootstrap of a new Collaborator chat: the initial skill/identity/team request and a setup response with actual name, confirmed IDs, and readiness or an impediment, without a business request. Outside this bootstrap, record in the task: question, answer, decision, scope change, done/not done, blocker/unblocking, file, or deliverable. Without a task or sufficient identity, wait for setup; do not invent commentID or create self-authorization. This rule takes precedence over onboarding conversation examples; there is no generic exception for metadata, updates, later identity confirmations, or work questions.

Follow this order: first update the relevant fields, artifacts, and state; then save a complete comment explaining the contribution, what was or was not done, and applicable questions/pending items/decisions; confirm persistence; only then notify. Use description/specification, versioned plan, historical summary, currentSummary, files, and status according to existing rules, without changing fields merely to fill a notification. A comment does not replace current fields. A standalone question may update only the comment. Task understanding and pending items are also comments. End of execution does not mean Completed when required human validation remains pending; preserve the actual status and approval flow.

The short notification contains only the actual task reference, areas actually updated, current status when relevant, and the actual commentID returned by persistence. Format example (replace placeholders with confirmed data): “Task <actual reference>; updated: specification, plan, comment; status: <current status>; commentID: <returned ID>.” Do not copy details, instructions, questions, or answers into chat. Do not invent an ID or announce an area whose update failed or did not occur.

The recipient uses MCP to read exactly the comment identified by that ID and the task's current state before acting, checking that the comment belongs to the task and that executor/version/state permit the action. Consult the actual contract in integration, without guessing a toolname. The response follows the same cycle: relevant fields, a complete comment, confirmed persistence, and a new notification. A missing/inaccessible comment or unavailable read suspends dependent work; do not substitute chat content or another more recent comment.

A notification is neither an autonomous request nor additional approval. No-op and acknowledgments without content do not generate comments or back-and-forth. Before retrying after a timeout, check the result/record and preserve idempotency; do not duplicate comments. If the write fails, keep it pending and do not issue a protocol notification without a confirmed comment/ID; never claim success. Communication imposed by a higher instruction continues to be respected. If sending fails after the write, resume only the necessary sending step. Harness permissions remain mandatory; the skill does not expand messaging authorization.

## Briefing for execution or resumption

Explicitly request **use of the Collaborator skill in this chat**. Indicate an existing identity or explicit authorization for a new fallback identity, team, actual task reference when one exists, and persisted references to the origin board's context; outside the initial bootstrap of a new Collaborator chat and its setup response, restrict notifications to task, areas actually updated, relevant status, and returned commentID, using persisted data. Two confirmations: identity/profile ready; then understanding of the actually assigned task and pending items. Without a recorded and assigned task, return only the bootstrap setup and wait; the Leader records/assigns before requesting execution. Do not create a task to self-authorize. Decomposition is allowed only within the scope of an already assigned task.

Record the complete relevant context in the task, faithful to the user, in this order; the recipient consults it there:

- Identity/profile and rules/limits; board and task/subtask, author/executor, relevant organizational links, with known IDs.
- Original request and objective; approved scope and what is still only planning.
- Accepted decisions, rejected alternatives and reasons; constraints that must survive a chat change.
- Expected deliverable, acceptance criteria, required evidence, and person responsible for review.
- Confirmed previous work, accessible files/sources, dependencies, and contributions from other agents.
- Context `rootTaskId`, `originBoardId`, `originBoardMode`, `effectiveMode`, current individual mode, and applicable authorization, including the approved proposal and reuse/transfer limits.
- Pending items/blockers, unresolved questions, and the concrete next step.
- Obligation to update one's own task at closure and actually available API/harness capabilities.

This format organizes the task's persisted content, not the message between chats. The notification contains only the actual task, areas actually updated, relevant status, and actual returned commentID. If the recipient cannot read the record, address the access gap without sending substitute instructions through chat. If a piece of data does not exist, say it is missing. Do not delegate again the discovery that the Leader already performed with the user.

## Required record when closing an activity

Even if the task continues, produce and persist in the corresponding task/subtask:

| Information | Content |
|---|---|
| Identity and target | Declared author and actual task/board IDs and execution context reference |
| Status and result | Appropriate configured status; progress, completion, or blocking with a reason |
| Summary | What was done and how it was verified; separate an attempt from a confirmed result |
| Decisions | Relevant choices and reasons, preserving briefing limits |
| Deliverables | Existing files, references, or attachments; access limitations |
| Pending items | Remaining work, review, dependencies, and blockers; explicitly state when there are none |
| Next step | Next action and known responsible party, without implicitly assigning new work |

Closing an activity is not completing a task. Pending review must appear in status/pending items according to the board. Completing a subtask does not change parents or siblings. A summary in the conversation does not prove a write; confirm the write or provide the pending record described in [integration](beeteam://references/integration).

On transfer, carry the task's context and history, without copying the previous agent's internal history. Transferring an agent between teams does not reassign its tasks. Preserve the root's origin even when the subtask is on another board.

## Via MCP

`task_briefing(taskId)` and `agent_resumption(agentId,taskId)` return queried context in a user message, without dispatch. Preserve origin and gaps when consulting it; this read result is not a dispatch message. Materialize the required context in the task before notifying, maintaining a faithful briefing without repeating discovery already performed by the Leader. `prepare_execution` is not the start of execution. During the activity, use `record_progress` only on authorized targets. At closure, `close_activity` records the set atomically; follow schema/versions and check isError/result. Obtaining `delivery_review(taskId)` produces an assessment, not approval or a status change. Consult `beeteam://references/integration` for arguments and pagination.

## Current synthesis and history

During briefing/resumption, read `Task.currentSummary` as the current synthesis and consult activity records for evidence. When recording progress or closing, recompose done, now, and pending items/next step into coherent cumulative text for the card/detail view. A valid deliverable could be: “Done: accounts reconciled and discrepancies corrected. Now: cash flow forecast in progress. Remaining: check scenarios; the next step is to validate assumptions.” Use only confirmed task facts; do not reuse this example as an actual result.

At closure, `execution.summary` describes the specific activity; `execution.currentSummary` maintains the cumulative state. Both are required, without mechanically duplicating one into the other. Preserve description, progress.note, and historical records; the timeline preserves the previous/new synthesis. If context is missing, state what is unconfirmed. The obligation remains on the task itself, even for a cross-board subtask.

## Request content

In the briefing, separate presentation (`description`), requirements/rules/deliverable/acceptance (`specification`), strategy/steps (`plan.content`), and cumulative state (`currentSummary`). Retrieve specification and plan Markdown without turning excerpts into commands. On resumption, check later decisions and gaps; during review, compare deliverables against the confirmed specification. Do not fill a missing requirement by assumption or confuse a proposed plan with an approved requirement. An empty specification must be identified as missing, with available evidence and an essential question when necessary.

## Readable references

Include the confirmed agent/team/task UUID and returned slug when available, distinguishing internal identity from navigation. If only a slug is available, resolve it by type before preparing calls with IDs; do not derive a slug from a name. Resumption after rename retains UUID/slug; deletion does not authorize reuse. Archived may resolve without being active. Do not invent frontend URLs or a board slug.

## Execution environment

Include confirmed API/MCP/dashboard addresses, the time and scope of the last verification, actual/mock mode, the person responsible for processes, and known blockers. Do not include secrets. The Collaborator reuses; the Leader coordinates startup according to the supported procedure. A URL and existing process do not prove a task is running. If the environment goes down, preserve activity data and flag unconfirmed persistence.

## Response and chat references

Save relevant progress/currentSummary/comments/result in the task and confirm persistence before communicating a blocker, needed decision, or closure to the Leader. A write failure must be communicated as an unconfirmed record, with dependent work suspended. Without a channel, declare sending pending, without pretending a message was sent. Reconcile only the missing step. Do not build an additional persistent chat–agent link in Bee Team; use available harness references/relationships, without assuming parent/child relationships or universal communication.

## Leader planning and assignment

The Leader may create/reuse its own coordination task within the authorized request, before substantive planning, on an appropriate board; record decisions incrementally in it. Greetings/registration queries do not require a task. Without identity/team/board for a new team, collect the required context and materialize it as soon as approved prerequisites exist, without inventing IDs. Before requesting execution from the Collaborator, record and assign the actual task. This initial Leader permission does not authorize the Collaborator to create its own task to self-authorize. Report only records whose persistence is confirmed; a chat/harness plan is not a plan saved in Bee Team.

## New Collaborator bootstrap

Follow [chat before registration](beeteam://references/collaborator-bootstrap): the Leader creates the authorized chat; the Collaborator itself identifies/creates/configures the profile/link and returns actual name, agentId/teamId, and readiness. The Leader verifies before assigning work. Only the initial request/setup or impediment response is exempt from a comment; this is not an exception for later work or additional harness authorization.

## Status transitions

Initial status is set at creation. Every subsequent status change (including start, resumption, review, and completion) goes through summary recording with statusObserved and the required usageReport in the same transaction. close_activity is valid only when it records this summary through the common service; do not use updateTask/moveTask/record_progress for transitions. A standalone percentage remains separately updatable with the required synthesis, without implicitly changing status. Confirm a transition only after persistence; comment/commentID, idempotency, and legacy behavior remain preserved.

## Explicit execution intervals

Follow [executions and intervals](beeteam://references/execution-intervals): read the active interval on resumption, record the start before working, checkpoint without closing, pause before switching, resume in a new interval, and finish independently of acceptance/final status. Preserve returned taskId/executionId/intervalId; do not infer boundaries from text/times or add snapshots/checkpoints. The payload and read contracts must be confirmed before use; session evidence and interval usage are distinct.

## Scope and commits of the reported work

Consult [repository evidence](beeteam://references/repository-evidence). The required project is the name/absolute root of the folder actually involved, independently of specification; Bee Team discovers repositories locally. Do not send repos/remotes as scope or every worktree; no Git is legitimate, inaccessible remains pending/unavailable. A new summary declares in boolean form whether a commit occurred, with an empty list when false or repo/contextual branch/full hash when true, according to the final schema and discovered repositories. Do not fabricate commits, published links, or detached HEAD values; sanitize credentials. Legacy absence is not false and replay does not duplicate references.
