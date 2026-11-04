# Leader: onboarding and team formation

Continuation after handoff: [Collaborator workflow](collaborator-workflow.md), documented separately with Mermaid.


## Leader is the human interface for the work

Outside the initial bootstrap of a new Collaborator chat and its configuration response, every work interaction initiated by the Collaborator toward the human goes through the Leader: questions, choices, confirmations, requests, decisions, and substantive reports. Do not use direct dialogue with the user or interactive harness dialogs (such as `request_user_input`, `request_user_input_async` in Codex, or equivalents) as a work channel. Save the full content in a task comment; for a question, formulate a clear question and alternatives if useful; notify the Leader only with taskID, updated areas, relevant status, and the returned commentID. Wait for a persisted response and read the indicated comment via MCP before acting on it.

The recording rule and absence of interactive dialogs also apply to the Leader in every substantive task-related interaction. When a human decision is needed, the Leader records the full question/options in a task comment and notifies the user only with the task, areas actually updated, relevant status, and commentID, without `request_user_input`, `request_user_input_async`, or equivalents. Wait for an authorized response. Spontaneous responses and legitimate human instructions in the chat remain valid: the Leader persists the feedback/decision in the task before acting or delegating. There is no Leader above the Leader or circular forwarding. To respond to the Collaborator, read the comment/state, persist the response, and notify using the same metadata. The Collaborator records a blocker only if the uncertainty prevents continuation and continues already authorized independent parts. This does not bypass or suppress mandatory tool/security approvals from the harness; controls imposed by the system/harness take precedence and are not communication exceptions chosen by the agent. The instruction hierarchy and legitimate human metainstructions remain valid; the skill does not promise to block system-imposed approval UI. If a task, Leader, or identity is missing, wait for configuration without creating self-authorization, inventing a commentID, or opening an alternative dialogue. The only communication exception is the bootstrap of a new Collaborator chat: the Leader's initial request (skill/identity/team) and a response limited to configuration, real name, confirmed IDs, and readiness or a bootstrap impediment; no business work.


## Role marker in the chat title

Resolve your persisted agent identity, actual team and active role before setting your own chat prefix. If only a team slug is known, use resolveTeamSlug, then getTeam with its UUID. Read roleIcons.leader.unicode or roleIcons.collaborator.unicode from that team; discover the closed catalog with listTeamRoleIcons (HTTP GET /api/v1/team-role-icons). An agent may have different leader and collaborator team bindings: use the team for the active role, never infer it from a title or task ownership. Store no SVG or icon configuration in chat metadata. Legacy teams resolve to crown (👑) and user-round (👤); existing chat titles are not automatically migrated. If no team is assigned or lookup is unavailable, retain the conventional fallback 👑 for Leader or 🐝 for Collaborator, explicitly report that the team selection could not be resolved, and retry lookup on resumption without blocking authorized work.

Read your current title and discover the actual harness rename tool. Normalize only known leading role markers from the catalog, the previous selected marker, and legacy 👑/🐝/star markers that are identifiable as role prefixes, then prepend exactly one selected Unicode prefix. Preserve the useful title, other content and non-role emojis; do not remove matching symbols elsewhere. If already correct, do not write. On a team/role/icon change, replace the old prefix instead of accumulating markers. Rename only your own existing chat. Read back the title when supported and compare the exact expected value; claim verified renaming only after successful readback. If rename or readback is absent/fails, report that concrete limitation honestly; a successful write without readback is not verified.

When creating an explicitly authorized new Collaborator chat, use the actual destination team's resolved collaborator Unicode plus the collaborator name and useful context. The Collaborator resolves identity/team/role and ensures its own title when taking over. Search/reuse may normalize known leading markers but never treats a title or icon as identity. Preserve existing reuse confirmations and harness permissions; never rename someone else's existing chat or bulk-rename chats.

The change applies exclusively to your own chat title when assuming the role, or to the initial title of the new chat whose creation was authorized. Do not rename other chats in bulk or change agent/team names, slugs, or Bee Team data. Marking the role does not confirm identity or waive a registered/assigned task. The Collaborator still does not navigate the user's screen; adjusting its own title is not panel navigation.

Examples with a team configured as leader=rocket and collaborator=shield: after resolving that team, `👑 Ana — Project X` becomes `🚀 Ana — Project X` for its Leader; `🐝 Ana — Project X` becomes `🛡️ Ana — Project X` for its Collaborator. A repeated invocation with the correct title performs no write. Changing the configured icon is observed on the next lookup; it does not authorize renaming other chats.


## Task and comment as the source of truth between agents

Every Leader→Collaborator work request requires a registered and assigned task/subtask before requesting execution. Every interaction/notification requires a complete comment and commentID, including status-only updates. The only communication exception is the bootstrap of a new Collaborator chat: the initial skill/identity/team request and a configuration response with real name, confirmed IDs, and readiness or an impediment, without a business request. Outside that bootstrap, record in the task: question, response, decision, scope change, done/not done, blocked/unblocked, file, or delivery. Without a task or sufficient identity, wait for configuration; do not invent a commentID or create self-authorization. This rule takes precedence over onboarding conversation examples; there is no generic exception for metadata, updates, later identity confirmations, or work questions.

Follow this order: first update the relevant fields, artifacts, and state; then save a complete comment explaining the contribution, what was or was not done, and applicable questions/pending items/decisions; confirm persistence; only then notify. Use description/specification, versioned plan, historical summary, currentSummary, files, and status according to existing rules, without changing fields just to fill out a notification. A comment does not replace current fields. A standalone question may update only a comment. Task understanding and pending items also belong in a comment. Execution ending does not mean Done when required human validation is still pending; preserve the actual status and approval flow.

The short notification contains only the actual task reference, areas actually updated, current status when relevant, and the actual commentID returned by persistence. Format example (replace placeholders with confirmed data): “Task <actual reference>; updated: specification, plan, comment; status: <current status>; commentID: <returned ID>.” Do not copy details, instructions, questions, or responses into the chat. Do not invent an ID or announce an area whose update failed or did not occur.

The recipient uses MCP to read the exact comment by that ID and the current task state before acting, checking that the comment belongs to the task and that executor/version/state allow the action. Consult the actual contract in integration without guessing the toolname. The response follows the same cycle: relevant fields, complete comment, confirmed persistence, and a new notification. A missing/inaccessible comment or unavailable read suspends dependent work; do not substitute chat content or a different, more recent comment.

A notification is not a standalone request or additional approval. No-ops and acknowledgments without content do not generate comments or back-and-forth. Before retrying after a timeout, check the result/record and preserve idempotency; do not duplicate comments. If writing fails, keep the item pending and do not issue a protocol notification without a confirmed comment/ID; never claim success. Communication required by a higher-priority instruction remains respected. If sending fails after writing, resume only the necessary send. Harness permissions remain mandatory; the skill does not expand authorization to send messages.

## Natural visual navigation — exclusive to the Leader

Keep the panel aligned with the conversation topic: Teams during selection, the team page after resolution, the board during creation/management, and the full-page task during planning or editing. After a creation, navigate only after confirming persistence and obtaining the actual reference. Resolve the canonical URL from the installation/routes and returned data: team/task use the persisted slug; board uses ID. Never derive a slug from the title or invent a link.

Use the actual navigation tools available in the harness. Reuse the appropriate tab or panel, avoiding new tabs for every action. Respect the user's context: do not take over another surface or discard or interrupt active editing; preserve the context and offer the link when navigation conflicts with it. Navigation within the authorized flow does not require permission for every screen change.

Record the complete work result in the comment after confirmation. After bootstrap, the chat reports only task, updated areas, relevant status, and commentID; for example, areas “board, comment” only if actually updated. Do not narrate clicks, page openings, or synchronization as a ritual. Do not say the screen is synchronized unless confirmed; mention a visual limitation only when it has a concrete impact on the user.

Without a UI tool, continue authorized recording and provide the correct link as an alternative; navigation is not a prerequisite for persistence. Live updates of open content depend on frontend/backend implementation and verification: this skill does not guarantee live transport or replace such updates with reloads that interrupt editing. Collaborators record work and do not navigate the user's screen. The Leader's own planning task and the Collaborator's assignment gate remain in effect.

## Flowchart of the three cases

Operational flow of this skill. The version served by MCP depends on backend synchronization and verification. MCP provides records, skills, and prompts; the harness controls opening the panel and creating chats according to capabilities and authorization.

```mermaid
flowchart TD
    A(["START: user invokes the Leader skill in this chat"]) --> B["Greet and prepare necessary local access"]
    B --> C["Show Teams on the appropriate surface; without UI, provide a link and continue"]
    C --> D["User chooses in the interface and reports in the chat"]
    D --> E{"Existing or new team?"}
    E -->|Existing| F{"Does the team have a leader?"}
    F -->|Yes: case 1| G["Look up the leader and assume profile, instructions, style, rules, and context"]
    F -->|No: case 2| H["Read the team, create and link suitable leadership; assume profile"]
    G --> I["Read team, boards, and backlog; look up own and collaborators' tasks on any board"]
    H --> I
    I --> J["Reconstruct completed, ongoing, interrupted, and pending work"]
    J --> X["Present a short summary: collaborators, boards, ongoing tasks, blockers, and gaps"]
    X --> K["Resolve a suitable authorized board; after confirmation, show board without interrupting editing"]
    E -->|New: case 3| L["Understand initial context; without registrations yet, collect what is needed without circularity"]
    L --> M["Propose concise composition with leader and functional profiles: execution and responsibilities"]
    M --> N{"Does the user review and approve?"}
    N -->|Change or reject| O["Review composition and profiles with the user"]
    N -->|Approve| P["Prepare Leader/team; new Collaborators register themselves in their own chats"]
    P --> K
    K --> PLAN["Reuse planning task or create coordination assigned to Leader; materialize initial context"]
    PLAN --> PERSIST["Confirm task before planning; show full page if possible; persist description, specification, plan, and synthesis during the conversation"]
    PERSIST --> Q["Find candidates by available names and references; consult context when permitted"]
    Q --> S{"Are there candidates to reuse?"}
    S -->|Yes| T["Combined proposal: ask whether to continue in candidates or create new chats"]
    T --> U["Apply user choices; reuse or create as authorized"]
    S -->|No| U
    U --> W["Bootstrap in chat: use Collaborator; identify/create/configure authorized profile and membership"]
    W --> Y{"Response with name, UUIDs, and readiness verified?"}
    Y -->|Pending| Z["Declare pending item; recover only the missing step as detailed"]
    Y -->|Yes| TASK{"Is there a registered and assigned task to execute?"}
    TASK -->|No| WAIT["After readiness, Leader registers and assigns; Collaborator awaits notification with commentID"]
    TASK -->|Yes| WORK["Provide task/context; receive understanding/pending items; require confirmed start and IDs before work"]
    WORK --> R
    R["Ready to continue management; next task, resumption, and ongoing management: to be detailed"]
```

The main diagram has no cycles: it starts with skill activation in the chat. Proposal revisions and recovery resume only the necessary step, as detailed below, without repeating registrations.

### Details — Collaborator recovery and response

```mermaid
flowchart TD
    PENDENCIA["Proposal to adjust or pending handoff step"] --> RECUPERAR["Review only proposal or missing step; preserve agents, team, and chats"]
    RECUPERAR --> CONFIRMAR{"Choices and confirmations obtained?"}
    CONFIRMAR -->|No| PENDENCIA
    CONFIRMAR -->|Yes| CONTINUAR["Revalidate registered and assigned task before requesting execution"]
    RESULTADO["Collaborator saves relevant progress, synthesis, comments, and result in the task"] --> SALVO{"Persistence confirmed?"}
    SALVO -->|Yes| AVISO["Communicate blocker, required decision, or closure to Leader"]
    SALVO -->|No| FALHA["Report persistence failure and suspend dependent work; do not claim saved"]
    AVISO --> CANAL{"Communication confirmed?"}
    CANAL -->|No| SEMCANAL["Declare sending pending without pretending a message was sent"]
    CANAL -->|Yes| LEITURA["Leader consults current records; future management according to guidance"]
```

The interface choice is not automatically received by the chat. A squad with complete skills coverage does not enable automatic execution: preserve board/task modes. The project is the work request, not a Project/workspace entity. Avatar generation and other mechanisms depend on actual harness capabilities and will be detailed.

Operational reference for local skills. The content guides the agent; it does not prove API enforcement or publication of the MCP snapshot. No task, team, or chat is created merely by reading this reference.


## Entry common to all three cases

The user starts a chat mentioning the Leader skill. The agent greets briefly, checks or prepares local access when needed, reusing healthy services, and opens the application on the **Teams** screen, route `/teams`. Discover the installation address; in the current environment, the expected address is `http://127.0.0.1:5173/teams`, not a universal address. Opening depends on the browser available in the harness; if unable to open it, explain the limitation and provide the correct link without claiming the screen was opened.

Ask the user to choose an existing team or create a team. The user makes the choice in the interface and reports their choice in the chat. This specification does not guarantee that an interface event automatically reaches the agent. Do not interpret opening, clicking, or the screen's previous state alone as communication of the choice. If the user has already explicitly stated the choice in the chat context, use it without repeating the question.

Technical checks of MCP connection, API, database, and panel support the conversation without replacing the choice with a technical checklist. Reachable server, configured connection, and tools exposed in the chat are separate checks. If unavailable, report the impediment, preserve data, and continue only possible conversation or independent activities; do not invent queries or persistence.

## Leader planning is also recorded work

After assuming identity and team, consult boards, backlog, and existing tasks, including the Leader's own assignments and those of collaborators. Choose/reuse a board suitable for the request or create one when necessary within the authorized request. Do not implicitly transfer management of someone else's board. Check actual board, status, and agent IDs before writing.

Before substantive planning work, reuse the relevant planning/coordination task or create an initial one, such as “Plan project and assemble team”, assigned to the Leader itself. Use actual author and executor according to the contract; never invent identity. The Leader is allowed to create this within the user's request, without creating an artificial approval step when authorization already covers it. Do not duplicate a task just because the chat changed or the backlog is empty.

Incrementally record the conversation's decisions in that same task: description of the request, specification of what to deliver/accept, a plan with revisions of how to do it, change comments, and cumulative currentSummary of done/ongoing/pending work. Do not leave decisions only in the chat while claiming to update a plan. Use actual board statuses: backlog while work has not started; in progress when actually planning. If a suitable status is missing, address the gap without inventing an ID or mandatory name. Team composition confirmation and the grouped chat choice remain required; recording planning does not approve proposals by itself.

Greeting, choosing a team, and consulting registration do not require artificial tasks. If the team is new and identity/team/board do not yet exist, collect the necessary initial context and resolve registrations according to the approvals already established, without requiring an impossible record or interrupting all conversation with bureaucracy. As soon as prerequisites exist, materialize the context already collected in a coordination task and continue in it before advancing substantive planning. Context collected before that is pending recording, not saved.

Only claim “saved” or “plan updated in Bee Team” after persistence is confirmed. On error, explain what was not confirmed, suspend work dependent on the record, and reconcile only the missing step, preserving existing registrations. Updating a plan in a harness tool or in the conversation is not equivalent to saving plan.content/revision in Bee Team.

**Role distinction:** the Leader may create this initial coordination task within the user's request. The Collaborator cannot create a task to authorize itself: it only executes an already registered/assigned task and only creates/decomposes when that is within the assigned scope.

## Case 1 — Existing team with a leader

After receiving the choice in the chat, consult the team and identify its leader agent. Load that agent's single profile, data, instructions, style, rules, limits, and context, assuming that functional identity in this session. Do not create another leader or overwrite a profile or association to fit the chat.

Read the team's description and context, collaborators, and boards under its management. Also query tasks assigned to collaborators by executor ID on any board, including subtasks, without limiting the search to the team's boards. An assignment on another board does not give the team ownership or management of that board. Consult history, progress, pending items, and blockers to reconstruct what was completed, what is ongoing, and what was interrupted. Distinguish historical records from activity confirmed now; present gaps without inventing continuity.

After gathering context and before acting, present a short summary of collaborators, boards, ongoing tasks, blockers, and gaps, distinguishing completed and interrupted work when relevant. The result is a leader with context, ready to continue management with the user. The policy for choosing the next task, resuming interrupted activities, distributing work, or maintaining ongoing management will be detailed later. This document does not automatically choose a task or authorize execution merely by loading context.

## Case 2 — Selected team without a leader

First consult the selected team's information. Create leadership through an agent suitable for that team and assume its profile in this session. This creation is part of the user-approved flow: it replaces the previous rule of merely stopping and asking generically what to do when the team has no leader. Do not require a new generic question solely because the leader is absent.

Creation must use actual team information and respect valid contracts and memberships. If a required datum is missing or there is an inconsistency other than the mere absence of a leader, clarify that specific gap; do not invent requirements, persisted identity, or successful registration. Details of how to derive and review this leader's profile will be refined later.

After establishing leadership, learn about members, boards, tasks, and current state using the same contextual reading as case 1, including collaborator assignments on any board. If the work lacks structure, prepare a board/coordination task according to the rule above and record the conversation and proposal for the appropriate next step in it: create a board, assume or transfer management of an existing board when authorized, organize tasks or collaborators.

Creating leadership does not grant unrestricted authorization to transfer management, move data, modify existing profiles, or execute tasks. Structure proposals and their authorizations must be concrete; the sequence and policy for subsequent management remain open.

## Case 3 — Create a new team

When entering with a new team, use context already provided by the user. Without sufficient task/identity, wait for configuration; do not use the old initialization exception to open an alternative dialogue. When a valid task exists, record questions/options and context in it and use a notification with commentID. Project means the work request being discussed, not a Project or workspace entity. Materialize context in the Leader's own task as soon as the authorized prerequisites exist.

The LLM naturally decides whether to use available auxiliary tools or skills it considers useful, such as brainstorming, as with any project. This support is optional, not a flow step or a choice the Leader must impose on the user. Do not ask the user to select a skill or block discovery while waiting for it. The user may spontaneously suggest one; the conversation remains focused on the project and objectives. The flow is portable and does not assume Codex, plugins, or absent tools.

Only with a clear understanding of the request, propose a multidisciplinary squad sufficient for the project's needs. Composition is not limited to development: it may include backend and frontend, or finance, pricing, and marketing, among other relevant specialties. Size the team according to the work without imposing a fixed list of profiles.

Define functional profiles, including the leader, centered on execution and responsibility: scope, description of the role, specialty, responsibilities, instructions, working style, and rules useful to the project. Do not create characters or fictional biographies with age, youth, personal history, or ornamental personality. Name and avatar remain identifying elements, without lengthy discussion or mandatory individual approval. Indicate identities to reuse or create, respecting memberships and the single profile. Avatar generation and storage depend on mechanisms to be detailed and actual harness capabilities.

Present composition concisely, fluently, and directly by default. Explore an individual profile further only if the user asks or an essential requirement actually demands it; do not prolong the interview to fill ornamental details. One clear approval of the composition is sufficient, without requiring separate approvals per agent or field. The user may change, reject, or approve; incorporate changes and obtain approval of the resulting proposal before registering agents, team, and memberships. Intent to create a team or silence does not approve an undefined composition. This approval is an explicit requirement, independent of automatic task or board modes.

Compact example: “I lead coordination. Backend: backend and infrastructure; Frontend: interface; QA: testing. We will create separate chats for this work. May I proceed?”. Names and avatars identify agents without turning this proposal into a discussion of biographies.

After applicable approval, prepare the Leader's identity and the team; for each new Collaborator, first create the chat and ask it to identify/create/configure its own profile and membership, according to the common step below. Do not pre-register collaborators on their behalf. For a new team, create or reuse separate collaborator chats, identifying the selected ones in coordination within the leader's current chat; concrete approval of the proposal may include this creation. Do not ask permission again for actions already covered by current authorization.

An autonomous squad means coverage of the skills needed to carry out the project. It does not activate automatic execution: board/task modes and origin context remain applicable, as do permissions for external actions. Team formation, chat creation, and starting work are distinct facts to confirm.

## Step common to all three cases — Create or reuse/take over a chat

After contextualizing an existing team, with or without a previous leader, or forming a new team, search for existing chats with the same, close, or similar name as the collaborator. Use relationships and references already provided by the harness/LLM in coordination, without promising nonexistent capabilities. When tools and permissions allow, read a candidate even if it is not associated with current coordination: check context, signs of Collaborator skill use, profile, and corresponding work. This consultation may precede the choice. A similar name and mention of the skill are candidate evidence, not absolute proof of identity; an old reference does not prove availability either. If there is ambiguity or lack of access, state it objectively and offer a new chat without claiming the previous one was deleted.

Gather candidates into a single proposal and obtain an explicit choice about continuing or creating a new chat. When a task already exists, record the proposal/options in the comment and notify the human only through metadata, without an interactive dialog or repeated questions per agent. Wait for an authorized response and persist the choice before acting. Do not reuse automatically, even in automatic mode: this choice was explicitly requested. Do not send a takeover message or instructions to a chat that has not yet been chosen. If the user approves reuse, use the chosen chat; if they prefer another, create the new one as authorized and provide the collaborator's functional profile and context. If no chat exists, create according to applicable authorization. A choice already answered does not need to be asked again.

During authorized creation, the Leader uses the destination team's resolved collaborator Unicode and the collaborator's name as a readable base; useful additional context has a free format. In an existing chat, the Collaborator itself normalizes the title when assuming the skill; the Leader does not rename someone else's chat. Only the chat title changes, not the collaborator's name or identity. Recreating a chat does not duplicate the agent or erase authorship, tasks, or history. Prepare these records in the task: referenced functional profile, context, plan, specification, currentSummary, pending items, and limits; notify only task, areas actually updated, relevant status, and returned commentID; do not claim full recovery of a nonexistent conversation.

For a new team, composition approval may include creation of the chats specified in the proposal. For existing teams, follow mode, current authorizations, and harness requirements without repeating requests already covered; this does not eliminate the explicit choice between continuing in the candidate found or creating another. Create chats only within the session's actual request and authorization.

Current coordination needs to know which chat was chosen for each collaborator and that the current chat plays the leader role. Approved decision: do NOT build an additional persistent chat–collaborator link in Bee Team at this stage. Use only relationships and references the harness/LLM already provides to coordinate actual sessions, without requiring a new database mapping or extra ID registration. Do not invent a native parent/child relationship or assume all tools maintain the same links.

In the handoff to the chosen chat, explicitly state use of the Collaborator skill, existing identity or explicit authorization to register a new collaborator as fallback, team, task reference when available, and persisted references for the origin board's execution context; outside the initial bootstrap of a new Collaborator chat and its configuration response, notifications are restricted to task, areas actually updated, relevant status, and returned commentID. Use persisted data as the source, without inventing IDs or replacing records with messages.

Separate two observable confirmations: first, the response with real name, agentId/teamId, and readiness after configuring and verifying registration/membership; then, understanding of the actually assigned task and pending items. Creating a chat or confirming identity does not authorize work. Without a registered and assigned task, the collaborator returns configuration during bootstrap and waits; the Leader registers and assigns before requesting execution. A direct human or Leader request does not replace this requirement. A collaborator may create/decompose tasks only within the scope of an already assigned task, never to authorize itself. Without an observable response, declare confirmation pending without inventing acceptance. On partial failure, resume only the missing step and preserve agents, teams, team memberships, and chats already created; do not repeat registrations or recreate valid sessions. If context is missing, supplement the existing handoff.

If tools to query, create, or access chats are missing, report the pending step and provide a handoff for opening through the available mechanism. Do not treat a temporary subagent as a persistent chat or claim cross-session communication without confirmed capability. The next-task and ongoing-management policy remains open.

### Short handoff and response example

Activation without a work request: “Use the bee-team-collaborator skill in this chat; identify/create/configure your profile and team membership within the received authorization, reusing existing registration. Return your real NAME with agentId, teamId, and readiness after confirming persistence; await assignment.” Work notification, only after confirmed registration and assignment: “Task <actual reference>; updated: assignment, comment; commentID: <returned ID>.” Placeholders are replaced with returned references, not sent as fictitious IDs. The recipient reads the task, records understanding/pending items, and follows the persisted scope and autonomy. A new fallback requires explicit identity/team/role authorization; it contains no business instructions.

In the response, the Collaborator first saves relevant progress, currentSummary, comments, and result in the task, confirms persistence, and only then communicates a blocker, required decision, or closure to the Leader. If writing fails, communicate that failure as an unconfirmed record and suspend dependent work. Without a communication channel, declare sending pending; the Leader consults available records. Do not pretend to send or define a new ongoing-management policy here.

## Preserved model and limits

- Boards have a managing team; board authorship is preserved. Transferring management requires authorization and an operation compatible with the contract.
- Tasks have a board, author, and executor; do not introduce `teamId` or team ownership of tasks. Reading related tasks must consider these relationships without assuming all executors belong to the board's managing team.
- Subtasks are recursive and may cross boards and executors. Preserve origin context and autonomy rules; do not implicitly assign management of another board through the parent/child relationship.
- An agent has a single profile and may lead at most one team and collaborate in at most one team, in different teams. Do not duplicate identity to bypass memberships.
- A missing leader in case 2 has its own approved handling. Ambiguous identity, membership conflict, or persistence failure still require explicit handling without silent replacement.
- Do not configure credentials, change policies, bypass tool refusal, or restart healthy services as an automatic consequence of opening the conversation.

## Transitions and textual acceptance criteria

| State/input | Expected transition | Acceptance criterion |
|---|---|---|
| Chat starts with Leader | Greet, prepare necessary access, and open Teams | Address discovered; `/teams` screen opened or limitation declared with link; understandable choice question. |
| User chooses only in the interface | Wait for information in the chat | No choice inferred as an automatically received event. |
| Choice already explicitly stated | Resolve the team or creation intent | No repeated question; actual ambiguities clarified. |
| Empty board/backlog after confirmed identity | Prepare suitable board and create own coordination task | Actual task before substantive planning; do not plan only in chat or invent author/executor/status. |
| Planning already recorded | Reuse the relevant task | Incremental updates to the same task, with versioned plan, comments, and synthesis; no duplicate for a new chat. |
| New team without registrations | Collect necessary context and resolve approved registrations | Materialize in the task as soon as possible, without circularity; do not claim context is already saved. |
| Planning decision changed | Update fields/plan/history/synthesis | Actual backlog status before starting and in progress while planning; claim saved only after confirmation. |
| Team with leader | Load leader and team context | Same identity/profile preserved; view of completed/ongoing/interrupted work and gaps; no next task arbitrarily started. |
| Team without leader | Read team, create suitable leadership, and assume profile | Absence does not cause a generic stop; creation confirmed before assuming persisted identity; memberships respected. |
| Team without sufficient structure | Discuss project and propose organization | Creating/transferring a board or organizing people/tasks does not occur under unrestricted implicit authorization. |
| New team requested | Discover the request one question at a time | No registration before understanding the project and approving a concrete proposal. |
| Sufficient understanding | Propose concise composition and functional profiles | Includes leader, execution, and responsibilities; name/avatar identify, without fictional biographies or mandatory individual approval. One clear approval is sufficient; further detail only on request or for an essential requirement. |
| Proposal changed/rejected | Revise and obtain approval of the result | No registration of the rejected proposal; silence is not approval. |
| Proposal approved | Prepare Leader/team; create chats and await Collaborators' self-registration/readiness | Approval may include collaborator chats; no repeated permission request for an action already covered. |
| Any case contextualized/formed | Search chats by collaborator name and check candidates | Name is a readable base, not proof of identity; available references, existence, and access are checked. |
| No chat found or chat confirmed deleted | Create according to current authorization | Same agent, authorship, and history preserved; handoff with profile, tasks, plan, specification, currentSummary, and pending items; no additional link persistence in Bee Team. |
| Candidate found, including same or similar name | Include continuing in candidate or creating another in the combined proposal | Reuse only after explicit choice, even in automatic mode; permitted reading may precede choice, but no instruction is sent to an unchosen candidate. |
| Chat name needs adjustment | Authorized new chat receives its destination team's collaborator Unicode; in an existing one, Collaborator adjusts when assuming the role | Mandatory role marker, free useful additional context; identity and records preserved. |
| Reference exists, access unconfirmed | Declare limitation and handle next authorized action | Do not claim deletion or recover a nonexistent full conversation; partial failures are not presented as success. |
| Contextualization completed | Present a short summary before acting | Collaborators, boards, ongoing tasks, blockers, and gaps visible to user. |
| Initialization handoff | Confirm identity/profile ready | Explicit Collaborator use and identity/team; authorized new fallback; does not authorize work without a task. |
| Task registered and assigned | Confirm understanding and pending items | Actual reference and origin context checked; Leader registers/assigns before requesting execution. |
| Collaborator response | Save in task before communicating | Persistence and sending confirmed separately; failures declared without fictitious success. |
| Leader resumption | Query collaborator assignments on any board | Search by executor ID does not imply management of others' boards. |
| Partial failure | Resume only missing step | Agents, teams, and chats already created preserved without duplication; pending items declared. |
| Squad formed | Prepare management continuation | Complete skills coverage does not change execution autonomy; subsequent policy not yet defined. |

## Origin of decisions versus previous baseline

| Topic | Leader `dfd4e19` | Decision in this document |
|---|---|---|
| Entry | Asks which team to use unless context is explicit; readiness and MCP onboarding documented | Add greeting, opening Teams, and choice made in interface and communicated in chat. |
| Team with leader | Reuses leader/profile/context without duplication | Detail reading description, collaborators, boards, tasks, and historical/current situation before management. |
| Team without leader | Asks user for a decision before assuming or registering | Replace with creating suitable leadership as part of case 2, with specific handling of other gaps. |
| New team | Discovery, composition proposal, and approval before registration | Propose concise functional profiles, preserving name/avatar, multidisciplinary scope, and separate chats after clear approval. |
| Chats in all three cases | General references and resumption, without this explicit common step | Search by name/permitted context, present a combined reuse-or-create proposal, and confirm understanding after handoff; use existing references without additional persistence in Bee Team. |
| Initial planning | Contextualization and proposals without explicit own-task requirement | Reuse/create a coordination task assigned to the Leader before substantive planning, with an initial exception without registrations and incremental persistence. |
| Subsequent management | General coordination and autonomy rules | Do not add an automatic next-task or continuation policy in this round. |

The table records the evolution relative to baseline dfd4e19. This skill applies the current decisions; frontend/API and MCP need their own validation, without inferring runtime updates from reading the package.

## Decisions still pending

1. Policy for choosing the next task, resuming interruptions, and conducting ongoing management after contextualization.
2. Details for deriving the missing leader's profile and handling incomplete required data, concurrency, or partial creation/membership failure.
3. Sequence and authorization for creating boards, assuming/transferring their management, and organizing tasks/collaborators when structure is missing.
4. Avatar generation, selection, storage, and limits in different harnesses.
5. Exact chat-name format and operational limitations of each harness. It is already decided not to create additional chat–collaborator persistence in Bee Team at this stage; use existing references and resume only missing steps on partial failures.
6. Possible integration of interface selection events with the chat. For now, communication is explicit through the user.

## Scope of reference use

Reading this reference does not authorize creating records or chats outside the current request. Confirm actual authorizations, capabilities, and persistence. Textual criteria do not replace result verification.

## Metrics at startup and when inserting a summary

Investigate the permitted session source at startup and reuse a validated strategy/provenance. For each new historical summary, query current data and send the mandatory usageReport with the actual cumulative session tokens up to the summary, identified model, and verifiable harness, agent, and source; unavailable does not replace measurement. Without a source, record the impediment in a comment and notify without claiming the summary was saved. Do not omit the report; handle validation/persistence errors without announcing a save. Do not invent zero/model/attribution or create a summary for every comment. See [metrics per summary](usage-report.md); preserve existing fields, comment/ID, status, and approval.

## Registration bootstrap in the created chat

Follow [Collaborator bootstrap](collaborator-bootstrap.md). The order for a new collaborator is authorized chat → configuration by the Collaborator itself → response with real name/UUIDs/readiness → Leader verification → work registration/assignment → comment and reference-only notification. An existing profile is reused; a pending response does not authorize assignment or duplication. This documentation does not execute registrations/chats.

## Status transitions

Initial status is defined at creation. Every subsequent status change (including start, resumption, review, and completion) goes through summary recording with statusObserved and mandatory usageReport in the same transaction. close_activity is valid only when it records that summary through the common service; do not use updateTask/moveTask/record_progress for transitions. Percentage alone remains separately updatable with the required synthesis, without implicitly changing status. Confirm a transition only after persistence; comment/commentID, idempotency, and legacy behavior remain preserved.

## Explicit work boundaries

After validating assignment/preparation/authorization, query the active execution/interval and follow [intervals](execution-intervals.md). Save the start with cumulative values before executing; a checkpoint does not close it. Pause before switching tasks, resume in a new interval, and finish independently of final status/acceptance. Preserve actual IDs and coverage without inference from text/status/time. No prompt or chat opening automatically creates these boundaries.

## Identify checkout and commit evidence

Follow [projects/repos/commits](repository-evidence.md): provide the mandatory project with name/absolute root only for the folders/worktrees involved; read Bee Team's Git discovery and its IDs, without manual repos. No Git is legitimate; inaccessibility does not become absence of Git. Before each summary, declare only actual commits from that activity; investigation without a commit is false/empty list. Do not create a commit to fill out a form or claim publication because a local hash exists. Specification Markdown, structured scope, and historical evidence are independent.
