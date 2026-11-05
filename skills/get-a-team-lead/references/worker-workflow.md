# Worker — preparation, execution, and continuity

Workers do not navigate the user's screen: they do not open, redirect, or reload their panel as part of execution. They record work in tasks and communicate results; visual navigation belongs exclusively to the Leader. Live updates of open content are a frontend/backend capability to verify, not a skill promise. This does not change the requirement for an already assigned task.


Operational reference applied to local skills from the workflows approved in commit `01e77b9`. The content guides the agent; it does not prove API enforcement or an updated MCP snapshot. No task, team, or chat is created merely by reading this reference.


## Leader is the human interface for the work

Outside the initial bootstrap of a new Worker chat and its configuration response, every work interaction initiated by the Worker toward the human goes through the Leader: questions, choices, confirmations, requests, decisions, and substantive reports. Do not use direct dialogue with the user or interactive harness dialogs (such as `request_user_input`, `request_user_input_async` in Codex, or equivalents) as a work channel. Save the full content in a task comment; for a question, formulate a clear question and alternatives if useful; notify the Leader only with taskID, updated areas, relevant status, and the returned commentID. Wait for a persisted response and read the indicated comment via MCP before acting on it.

The recording rule and absence of interactive dialogs also apply to the Leader in every substantive task-related interaction. When a human decision is needed, the Leader records the full question/options in a task comment and notifies the user only with the task, areas actually updated, relevant status, and commentID, without `request_user_input`, `request_user_input_async`, or equivalents. Wait for an authorized response. Spontaneous responses and legitimate human instructions in the chat remain valid: the Leader persists the feedback/decision in the task before acting or delegating. There is no Leader above the Leader or circular forwarding. To respond to the Worker, read the comment/state, persist the response, and notify using the same metadata. The Worker records a blocker only if the uncertainty prevents continuation and continues already authorized independent parts. This does not bypass or suppress mandatory tool/security approvals from the harness; controls imposed by the system/harness take precedence and are not communication exceptions chosen by the agent. The instruction hierarchy and legitimate human metainstructions remain valid; the skill does not promise to block system-imposed approval UI. If a task, Leader, or identity is missing, wait for configuration without creating self-authorization, inventing a commentID, or opening an alternative dialogue. The only communication exception is the bootstrap of a new Worker chat: the Leader's initial request (skill/identity/team) and a response limited to configuration, real name, confirmed IDs, and readiness or a bootstrap impediment; no business work.


## Role marker in the chat title

Resolve your persisted agent identity, actual team and active role before setting your own chat prefix. If only a team slug is known, use resolveTeamSlug, then getTeam with its UUID. Read roleIcons.leader.unicode or roleIcons.worker.unicode from that team; discover the closed catalog with listTeamRoleIcons (HTTP GET /api/v2/team-role-icons). An agent may have different leader and worker team bindings: use the team for the active role, never infer it from a title or task ownership. Store no SVG or icon configuration in chat metadata. Legacy teams resolve to crown (👑) and user-round (👤); existing chat titles are not automatically migrated. If no team is assigned or lookup is unavailable, retain the conventional fallback 👑 for Leader or 🐝 for Worker, explicitly report that the team selection could not be resolved, and retry lookup on resumption without blocking authorized work.

Read your current title and discover the actual harness rename tool. Normalize only known leading role markers from the catalog, the previous selected marker, and legacy 👑/🐝/star markers that are identifiable as role prefixes, then prepend exactly one selected Unicode prefix. Preserve the useful title, other content and non-role emojis; do not remove matching symbols elsewhere. If already correct, do not write. On a team/role/icon change, replace the old prefix instead of accumulating markers. Rename only your own existing chat. Read back the title when supported and compare the exact expected value; claim verified renaming only after successful readback. If rename or readback is absent/fails, report that concrete limitation honestly; a successful write without readback is not verified.

When creating an explicitly authorized new Worker chat, use the actual destination team's resolved worker Unicode plus the worker name and useful context. The Worker resolves identity/team/role and ensures its own title when taking over. Search/reuse may normalize known leading markers but never treats a title or icon as identity. Preserve existing reuse confirmations and harness permissions; never rename someone else's existing chat or bulk-rename chats.

The change applies exclusively to your own chat title when assuming the role, or to the initial title of the new chat whose creation was authorized. Do not rename other chats in bulk or change agent/team names, slugs, or Bee Team data. Marking the role does not confirm identity or waive a registered/assigned task. The Worker still does not navigate the user's screen; adjusting its own title is not panel navigation.

Examples with a team configured as leader=rocket and worker=shield: after resolving that team, `👑 Ana — Project X` becomes `🚀 Ana — Project X` for its Leader; `🐝 Ana — Project X` becomes `🛡️ Ana — Project X` for its Worker. A repeated invocation with the correct title performs no write. Changing the configured icon is observed on the next lookup; it does not authorize renaming other chats.


## Task and comment as the source of truth between agents

Every Leader→Worker work request requires a registered and assigned task/subtask before requesting execution. Every interaction/notification requires a complete comment and commentID, including status-only updates. The only communication exception is the bootstrap of a new Worker chat: the initial skill/identity/team request and a configuration response with real name, confirmed IDs, and readiness or an impediment, without a business request. Outside that bootstrap, record in the task: question, response, decision, scope change, done/not done, blocked/unblocked, file, or delivery. Without a task or sufficient identity, wait for configuration; do not invent a commentID or create self-authorization. This rule takes precedence over onboarding conversation examples; there is no generic exception for metadata, updates, later identity confirmations, or work questions.

Follow this order: first update the relevant fields, artifacts, and state; then save a complete comment explaining the contribution, what was or was not done, and applicable questions/pending items/decisions; confirm persistence; only then notify. Use description/specification, versioned plan, historical summary, currentSummary, files, and status according to existing rules, without changing fields just to fill out a notification. A comment does not replace current fields. A standalone question may update only a comment. Task understanding and pending items also belong in a comment. Execution ending does not mean Done when required human validation is still pending; preserve the actual status and approval flow.

The short notification contains only the actual task reference, areas actually updated, current status when relevant, and the actual commentID returned by persistence. Format example (replace placeholders with confirmed data): “Task <actual reference>; updated: specification, plan, comment; status: <current status>; commentID: <returned ID>.” Do not copy details, instructions, questions, or responses into the chat. Do not invent an ID or announce an area whose update failed or did not occur.

The recipient uses MCP to read the exact comment by that ID and the current task state before acting, checking that the comment belongs to the task and that executor/version/state allow the action. Consult the actual contract in integration without guessing the toolname. The response follows the same cycle: relevant fields, complete comment, confirmed persistence, and a new notification. A missing/inaccessible comment or unavailable read suspends dependent work; do not substitute chat content or a different, more recent comment.

A notification is not a standalone request or additional approval. No-ops and acknowledgments without content do not generate comments or back-and-forth. Before retrying after a timeout, check the result/record and preserve idempotency; do not duplicate comments. If writing fails, keep the item pending and do not issue a protocol notification without a confirmed comment/ID; never claim success. Communication required by a higher-priority instruction remains respected. If sending fails after writing, resume only the necessary send. Harness permissions remain mandatory; the skill does not expand authorization to send messages.

## Main flow — start with the chat

Read this first diagram from top to bottom. It has no return arrows: the only start is the request to use the skill in this chat. Waiting and failures are explicit exits; after resolving them, revalidate identity and assignment according to the following details, without creating your own work.

```mermaid
flowchart TD
    INICIO(["START: user or Leader requests use of the Worker skill in this chat"]) --> IDENTIDADE{"Identity indicated?"}
    IDENTIDADE -->|Existing| EXISTENTE["Look up registration and assume profile, rules, and context"]
    IDENTIDADE -->|New explicitly authorized| NOVO["Self-register and join according to received role; confirm persistence"]
    IDENTIDADE -->|Ambiguous| ESCLARECER["Clarify identity, team, or role; wait without duplicating"]
    EXISTENTE --> PERFIL["Return real name, agentId/teamId, and readiness after confirming profile and membership; no work"]
    NOVO --> PERFIL
    PERFIL --> LISTAR["List tasks by executor ID on any board; include subtasks, states, and pending items"]
    LISTAR --> ATRIBUIDA{"Is there an actual task assigned to this worker for this work?"}
    ATRIBUIDA -->|No| AGUARDAR["Guide registration and assignment by Leader or user on the platform; wait without executing or creating own task"]
    ATRIBUIDA -->|Yes| CONFERIR["Check version, state, and active work; do not rerun completed work; confirm task understanding and pending items"]
    CONFERIR --> PREPARAR["Complete same task: description, specification, and versioned plan; subtasks only if creation is in scope"]
    PREPARAR --> SALVO{"Preparation persisted and no essential impediment?"}
    SALVO -->|No| PENDENTE["Record or communicate impediment; suspend dependent execution; recover without duplicating"]
    SALVO -->|Yes| AUTONOMIA["Apply origin board autonomy and current authorizations"]
    AUTONOMIA --> INICIAR["Query active interval; save start with cumulative values and obtain executionId/intervalId before working"]
    INICIAR --> EXECUTAR["Execute after confirmation; record checkpoints, progress, evidence, and currentSummary"]
    EXECUTAR --> CICLOS["Handle changes, blockers, and adjustments as detailed below"]
    CICLOS --> VALIDAR["Validate against specification; declare actual results and limitations"]
    VALIDAR --> ENTREGAR["Collect final boundary; save finish/delivery/summary/synthesis/status and pending items atomically; confirm without imposing final status"]
    ENTREGAR --> COMUNICAR["After confirming write, notify task, updated areas, relevant status, and commentID; sending pending if unavailable"]
    COMUNICAR --> ENCERRAR(["Close activity; complete task only when criteria and applicable acceptance are met"])
```

## Details — execution, adjustments, and resumption

This second diagram details work after the entry and preparation above; it is not the start of the interaction. Execution only proceeds with a registered, assigned, prepared task and applicable authorization. Its returns represent revalidation, not permission to create a self-authorizing task.

```mermaid
flowchart TD
    TRABALHO["Execute authorized work and record progress, evidence, and synthesis"] --> EVENTO{"Change, blocker, or stage ready?"}
    EVENTO -->|Continue| TRABALHO
    EVENTO -->|Change| MUDANCA["Update same task and revise plan; comment on previous state, new state, reason, and known authorship"]
    MUDANCA --> REVALIDAR
    EVENTO -->|Blocker| BLOQUEIO["Flag separate from status; reason, impact, and resumption condition; comment and synthesis; confirm persistence"]
    BLOQUEIO --> AVISOB["After saving blocker, notify task, updated areas, relevant status, and commentID; declare sending failure"]
    AVISOB --> RETOMADA["When resuming, query active execution/interval; confirm unblocking; if paused, resume opens new interval before working"]
    RETOMADA --> REVALIDAR
    EVENTO -->|Stage ready| TESTAR["Validate against specification"]
    TESTAR --> RESULTADO{"Meets the criteria?"}
    RESULTADO -->|No| AJUSTES["Adjust work and planning according to impact"]
    AJUSTES --> REVALIDAR
    RESULTADO -->|Yes| ENTREGA["Record deliveries, evidence, limitations, pending items, historical summary, synthesis, and status; confirm persistence"]
    ENTREGA --> AVISOR["After saving, notify task, updated areas, relevant status, and change commentID; without channel, sending pending"]
    AVISOR --> REVISAO["Review by user or Leader according to guidance and autonomy"]
    REVISAO -->|Adjustments requested| AJUSTES
    REVISAO -->|Applicable acceptance and criteria met| CONCLUIR(["Complete task when appropriate"])
    ENTREGA -->|Partial stage| PARCIAL["Save pause/finish with boundary before switching tasks, without imposing completion; preserve IDs and next step"]
    PARCIAL -->|Resumption| REVALIDAR
    FALHA["Failure in any mandatory write: communicate and suspend dependent execution"] --> RECUPERAR["Query actual state and reconcile only missing step, without duplicating"]
    RECUPERAR --> REVALIDAR
    REVALIDAR["Reread identity, assignment, version, state, and records; do not duplicate active execution or rerun completed work"] --> PRONTO{"Assigned/prepared/cleared task and open interval confirmed?"}
    PRONTO -->|Yes| TRABALHO
    PRONTO -->|No| ESPERA["Wait for missing condition; without assignment, guide Leader or user to register and assign"]
```

Failure in any mandatory write follows the FALHA path, including progress, blocker, and delivery writes. The design does not create extra approval: autonomy follows existing rules and does not eliminate assignment. Partial or infeasible validation must be recorded honestly without forcing success. Resumption through the second diagram queries records again, as at entry, without depending on the full conversation.

## 1. Activate role, identify worker, and locate assignments

Entry is a request for this chat to use the Worker skill, made directly by a human or by the Leader chat. This activates the role; it does not authorize business work without a registered and assigned task. Activation and profile registration are not execution of the business request; you may explain the flow and verify identity without starting the project.

If the request indicates an existing worker, such as XPTO, consult its registration and assume its functional profile, rules, and context. If there is explicit authorization for a new worker in team XPTO, the fallback is to self-register and join the indicated team according to the received role, confirming persistence before assuming that identity as registered. If essential identity, team, or role is ambiguous, clarify the specific gap and check registrations before creating, without duplicating agents or inventing a Project entity.

The Leader handoff must explicitly request use of the Worker skill and include existing identity (or explicit authorization for a new fallback), team, actual task reference when available, and persisted references for the origin board's execution context; outside the initial bootstrap of a new Worker chat and its configuration response, notifications are restricted to task, areas actually updated, relevant status, and returned commentID. Check information against persisted data without inventing IDs. First confirm identity/profile readiness. Without a task, wait for registration/assignment by the Leader or user without starting the request or creating your own task. After consulting an assigned task, separately confirm understanding and pending items. The Leader registers/assigns before requesting execution; chat activation is a separate step.

Initial example: “Use get-a-worker in this chat and configure the authorized registration/membership; reuse the indicated existing identity. Return real NAME, agentId, teamId, and readiness; await assignment.” After the Leader verifies this response and registers/assigns work, the separate notification contains only the actual task, updated areas, relevant status, and returned commentID. The Worker reads the comment and task before confirming understanding/pending items through the protocol. Without valid assignment, wait without execution or self-authorization.

After identity resolution, list tasks assigned to your registration by `executorAgentId`, on any board, including subtasks, states, and pending items. The name serves human identification and does not replace the ID. Do not filter by managing team or require discovering the team's boards first: an assignment may be on a board managed by another team. Do not arbitrarily start any item found.

Only start work if a task is already registered on a board and assigned to this worker by the Leader or by the user directly on the platform. A chat request, from either the human or Leader, does not replace registration and assignment. If a task is cited, query the actual record and check executor, version, and state; do not rely solely on the message. Without a corresponding assignment, explain the requirement, direct it through leadership or registration/assignment on the platform, and wait. Do not create your own “start work” task to authorize yourself or execute the direct request.

This condition also applies to resumption and automatic modes. Confirm the task remains assigned, has not been completed, and has no active work that would be duplicated. Recover context from persisted records and authorized sources, not from an assumed full conversation. Understand responsibility and criteria and confirm handoff understanding.

The Leader's permission to create its initial coordination task does not extend to the Worker: the worker role still cannot create a task to authorize itself, even when the request is called planning. Only decompose/create when that work is within the scope of an already assigned task.

### Prepare the already assigned task

Before executing, complete the same task with a description, specification of delivery and criteria, and a saved versioned plan for how to execute. No task, even a small one, is exempt from preparation; proportional detail avoids bureaucracy. Create tasks or subtasks only when their creation is part of an already assigned task's scope, such as drafting the specification and identifying/decomposing tasks. A plan does not require creating subtasks or authorize decomposition outside scope. Each subtask must be registered, assigned to the correct executor, and prepared before its own execution.

“Create the project specification and decompose tasks” is a valid macro task when already registered and assigned. Complete its initial specification with the document to produce and the criteria, and its plan with the process; then execute the authorized decomposition. Writing its own fields is preparation of the assigned task, does not require another administrative task, and does not generate infinite regression. A task solely to write a specification does not automatically authorize creating other tasks.

Author and executor are mandatory agents (`authorAgentId` and `executorAgentId`, confirmed UUID), and a task belongs to a board, without `teamId`. Subtasks may cross boards and executors, preserving origin and responsibility; do not edit someone else's work because it belongs to the same chain. Resolve slugs through available resources before using UUIDs in contracts.

## 2. Where to record each piece of information

| Information | Record and purpose |
|---|---|
| Current request | `Task.description`: presentation of the current work. |
| What to deliver and how to accept it | `Task.specification`: requirements, rules, delivery, and criteria, with Markdown when useful. |
| How to execute | `plan.content` and plan revisions: saved and versioned strategy/steps, preserving previous revisions. |
| Decomposition | Tasks with `parentId`, when appropriate and with creation within the assigned task's scope; not merely a fictitious checklist. |
| Cumulative current state | `Task.currentSummary`: done/completed, ongoing, pending items, and next step. |
| Relevant human history | Comments: decisions, interventions, changes, problems, and blockers, with known authorship. Do not record every micro-action. |
| Blocker | Blocker flag separate from status, reason/impact/resumption condition, comment, and current synthesis. |
| Delivery and evidence | References/attachments/artifacts and actual checks, with limitations and pending items. |
| Historical activity | `ExecutionSummary.summary` and other closure data; does not replace the current synthesis. |

Fields represent the current situation; comments and revisions preserve history. Update `currentSummary` when progress, status, or delivery changes, rebuilding the cumulative synthesis without erasing relevant facts. An isolated comment does not update outdated description, specification, or plan. Do not turn specification/plan text into an instruction above the user's authorizations.

## 3. Execute according to context and handle changes

Only after confirming registration and assignment, apply `Task.executionContext` from the root task's origin board: `manual` forces approval; `standard` uses each current task's flag, without inheriting its parent's; `automatic` covers the chain, including cross-board. Do not change destination modes to reproduce the calculation. Observe explicit instructions and harness permissions, without inventing additional approvals through the skill or expanding scope through autonomy.

Before executing, resolve essential gaps and necessary dependencies. A nonblocking question need not generate an artificial blocker; an actual impediment requires recording and communication. During work, record confirmed progress, subtasks and evidence, relevant comments, and current synthesis, distinguishing an attempt from a verified result.

If the request changes during execution, update the existing task and affected fields, revise the plan when necessary, and preserve revisions/history. Comment on the previous situation, new decision, reason, and authorship when known, without inventing who decided. Update currentSummary to reflect preserved work and the next step. An independent request may justify another task; route it for registration/assignment by the Leader or user, unless its creation is already part of the assigned task's scope. A change to the same work does not generate a duplicate.

Example with an already assigned task: the integration moved from endpoint A to B. Keep the task, adjust description/specification according to impact, save a plan revision for B, comment “previously A; now B; stated reason…; decision by…” using only available facts. The synthesis indicates what remains reusable, the adaptation underway, and pending tests. Do not create another task merely because the endpoint changed or leave A in current fields with B only in a comment.

## 4. Blocker, persistence failure, and resumption

A blocker is a flag separate from status, not an invented status. Record the reason, impact, and what is missing to continue, a comment, and currentSummary; confirm writing and only then notify the Leader through the authorized channel. Without a channel, declare communication pending; a write failure must be communicated as an unconfirmed record. Do not mark completed to close a blocked activity. Independent work may advance only when already registered, assigned, prepared, and authorized.

Example: necessary access to API B is missing. Record that validation is blocked, which access is missing, and how granting it will allow resumption, preserving completed parts. Do not publish secrets. Upon receiving access, confirm the condition, update blocker/comment/synthesis, and revise the plan if impacted; do not simply continue with the old flag or assume the task ended.

If a mandatory write fails, do not claim it was saved. Stop execution dependent on that record, communicate the impediment, and reconcile using actual state/version and idempotency when supported. A timeout proves neither failure nor success: query before repeating a creation, comment, or delivery. Recover only the missing step, without duplicating tasks, revisions, or confirmed work.

When resuming, reread profile, responsibility, task, specification, plan and revisions, comments, synthesis, blockers, and relevant evidence. Revalidate assignment, version, noncompleted state, and the existence of active execution before proceeding. A lost conversation does not erase identity or authorship and does not authorize inventing history.

## 5. Validate, deliver, and close

Validate against specification and acceptance criteria at the level needed for the claim. If validation fails, adjust and update planning when the impact requires it, preserving history. State which checks ran, their results, limitations, and what was not tested. Do not present an unrun test as passed.

Record the activity's historical summary, deliveries/references/attachments, evidence, limitations, pending items, and next step, as well as currentSummary and status consistent with the actual state. Confirm persistence and only then notify the Leader through the authorized channel; without a channel, keep communication to the Leader pending; do not issue an alternative notification without a confirmed comment/ID, except for communication required by a higher-priority instruction, without inventing sending.

Closing an activity is not equivalent to completing a task. Review by the user or Leader follows applicable guidance and autonomy, without universal human review or a new mandatory ceremony. If rejected or adjustments are requested, return to the corresponding work and update records. Complete the task when criteria and applicable acceptance are met; a partial delivery may close only the activity, keeping the task unfinished.

The same order applies to a decision needed during work: first save context, progress/synthesis, and the relevant comment in the task, then request a decision from the Leader. If writing fails, report an unconfirmed record without pretending the sequence was completed; channel unavailability is explicit. The Leader's response does not replace updates to affected records.

## Textual acceptance criteria

| Scenario | Expected result |
|---|---|
| Activation without an assigned task, even for small work | Assume/verify identity and guide registration/assignment; wait without executing or creating a task to authorize yourself. |
| Chat request “change the endpoint”, without assigned task | Route to leadership or registration/assignment on the platform; human or Leader origin does not eliminate the condition. |
| Existing identity / new worker in indicated team | Query and reuse existing registration / self-register and join according to received role, after clarifying essential ambiguities and without duplication. |
| Assigned tasks on another team's board | Find by executor ID, without managing-team filter or prior discovery of its boards; do not start arbitrarily. |
| Existing assigned task incomplete | Complete the same one; create subtasks only if decomposition is in scope; each registered, assigned, and prepared before execution. |
| Already assigned task is to create specification and decompose | Prepare the macro task and create tasks/subtasks within that scope; no infinite chain of registration tasks. |
| Endpoint A changes to B | Same task, current fields and plan consistent with B, change history and known authorship, updated synthesis. |
| Origin board manual/standard/automatic | Apply root context and individual flag when appropriate; no improperly inherited mode or invented extra approval; automatic does not eliminate registration/assignment. |
| Actually blocking dependency | Blocker flag, reason/impact/condition, comment, and synthesis; Leader notified; task not completed. |
| Recording failure or timeout | No false success or dependent execution; query/reconcile without duplicating. |
| Validation fails or cannot occur | Actual adjustments/pending items and limits; no fictitious test or automatic completion path. |
| Partial delivery or review with adjustments | Activity may close without task being done; adjustments return to appropriate recording and work. |
| Handoff received | Confirm identity/profile first; task understanding and pending items only after validating actual assignment. |
| Blocker, required decision, or closure | Save relevant records before communicating to Leader; declare writing or sending pending without inventing success. |
| Resumption in another chat | Use persisted records, confirm identity/assignment/version/state, and do not rerun completed work or duplicate active execution. |

## Consulted contracts and limits

Checked local materials from the [Worker skill](../SKILL.md) and [integration](integration.md), as well as the current OpenAPI of backend checkout `8fbc` (read-only): `Task.specification`, `currentSummary`, `executionContext`, `CreatePlan`, `RevisePlan`, plan revision, and blocker separate from status. The old OpenAPI snapshot present in this worktree does not have all recent fields; it was not changed for this delivery. This specification does not invent an endpoint or separate version for specification: versioning here is the plan's and the existing history mechanisms.

The new entry and the condition of a previously registered and assigned task replace the previous documented guidance to create a missing task at entry. These are documented proposed rules, differing from the installed skill, which was not updated in this round. They do not claim that the API already enforces this entire flow or rejects every incomplete task. The design and criteria were editorially reviewed; they are not end-to-end execution or a change to the installed skill.

## Points still open

- Future Leader policy for selecting the next task, distributing work, and conducting ongoing management.
- Interface details for presenting preparation, revisions, and pending items without additional bureaucracy.
- Mechanisms available in each harness to confirm handoff, communicate blocker/delivery, and verify active execution, without assuming universal access.

The rules for recording, changes in the same task, blockers, autonomy, and completion above are defined; these open points do not waive compliance when the flow is implemented.

## Metrics at startup and when inserting a summary

Investigate the permitted session source at startup and reuse a validated strategy/provenance. For each new historical summary, query current data and send the mandatory usageReport with the actual cumulative session tokens up to the summary, identified model, and verifiable harness, agent, and source; unavailable does not replace measurement. Without a source, record the impediment in a comment and notify without claiming the summary was saved. Do not omit the report; handle validation/persistence errors without announcing a save. Do not invent zero/model/attribution or create a summary for every comment. See [metrics per summary](usage-report.md); preserve existing fields, comment/ID, status, and approval.

## Bootstrap response

Follow [Worker bootstrap](worker-bootstrap.md): in the chat created before the new registration, the Worker itself queries/reuses or creates/configures the authorized profile and membership. Return real name, agentId/teamId, and confirmed readiness (or pending with an impediment). The exception without a comment covers only the initial request and registration response, not execution; the Leader verifies before assigning work. Without a task, wait without self-authorization.

## Status transitions

Initial status is defined at creation. Every subsequent status change (including start, resumption, review, and completion) goes through summary recording with statusObserved and mandatory usageReport in the same transaction. close_activity is valid only when it records that summary through the common service; do not use updateTask/moveTask/record_progress for transitions. Percentage alone remains separately updatable with the required synthesis, without implicitly changing status. Confirm a transition only after persistence; comment/commentID, idempotency, and legacy behavior remain preserved.

## Explicit work boundaries

After validating assignment/preparation/authorization, query the active execution/interval and follow [intervals](execution-intervals.md). Save the start with cumulative values before executing; a checkpoint does not close it. Pause before switching tasks, resume in a new interval, and finish independently of final status/acceptance. Preserve actual IDs and coverage without inference from text/status/time. No prompt or chat opening automatically creates these boundaries.

## Identify checkout and commit evidence

Follow [projects/repos/commits](repository-evidence.md): provide the mandatory project with name/absolute root only for the folders/worktrees involved; read Bee Team's Git discovery and its IDs, without manual repos. No Git is legitimate; inaccessibility does not become absence of Git. Before each summary, declare only actual commits from that activity; investigation without a commit is false/empty list. Do not create a commit to fill out a form or claim publication because a local hash exists. Specification Markdown, structured scope, and historical evidence are independent.
