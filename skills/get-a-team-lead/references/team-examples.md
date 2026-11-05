# Adaptable team examples

These are proposed divisions of work, not fixed teams or execution authorization. For each request, consult existing profiles and context; team formation requires concrete user approval regardless of task/board autonomy. Execution/chat approvals follow their own rules.

## Opening and formation

| Situation | Expected response before any registration |
|---|---|
| New chat without an indicated team | Greet, open Teams at the confirmed address, and ask for existing/new choice; user reports choice in chat, without replacing conversation with an MCP checklist. |
| User chooses existing team | Consult team and leader; load profile/instructions/style/rules/context, assume that role, and resume relevant work without creating or overwriting identity. |
| Context explicitly says “use team Alfa” | Resolve and consult Alfa without repeating the choice question. An ambiguous name requires clarification, not arbitrary selection. |
| No suitable team | “Do you want to create a team?”; if yes, first ask about the project objective, then clarify scope one question at a time. Do not create records yet. |
| Request understood | Propose leader and workers with responsibilities and rationale, explaining reuse/creation; await concrete approval. |
| User changes or rejects composition | Incorporate the change, present the resulting composition again, and await confirmation; nothing from the rejected proposal is registered. |
| Team without leader or inconsistent memberships | For a selected team without a leader, read team and create/link suitable leadership according to the flow; a distinct inconsistency or missing essential datum requires specific clarification, without duplicating identity. |
| Automatic board, team not yet approved | Preserve formation approval; execution autonomy does not approve agents/team/memberships. |

New-team example: after understanding that the user wants a website with an API, propose “I will lead the work; I propose Ana for the interface and Bruno for the API, because these deliveries have distinct contracts. We will reuse available profiles if memberships permit. Do you approve this composition?”. If the user asks for a single person to implement it, adjust the proposal before registering. Project remains a description of the request; do not create a Project/workspace entity.

## Development: website with API

Request: build a website that queries an API, with publication scope separate.
Division: interface produces screens; API produces contract and service; validation checks integration and acceptance criteria. Separation allows independent execution after agreeing on contract and example data. Integration validation depends on both deliveries.
Deliverables: screens, contract/service, test evidence, and pending publication items.
Reuse: worker familiar with interface or API whose chat still has relevant context. Create: session for an independent workstream without suitable context; a new profile only if the required role is unavailable, respecting memberships. Do not create three people if a small change fits within one person's work.
Proposal: “Reuse Ana for the interface and Bruno for the API; create a chat for Carla to validate when both deliver. Deliver tested integration; publication remains outside scope.”

## Treasury: cash flow

Request: organize accounts and project cash flow for 90 days, without moving money.
Division: accounts organizes payables/receivables; projection uses reconciled balances and due dates; checking identifies discrepancies and gaps. Separating the data source from projection makes assumptions easier to check.
Deliverables: reconciled dataset, projection by period, list of discrepancies and assumptions. Projection depends on the dataset; checking can examine samples while it is prepared.
Reuse: someone familiar with previous categories and sources, after checking they are up to date. Create: chat for independent checking if volume and capacity warrant it; do not duplicate identity just because the old chat was closed.
Proposal: “Ana organizes accounts; Bruno projects after receiving the dataset; Ana checks discrepancies if volume permits, or I propose a third workstream. No payment will be executed.”

## Finance: costs, budget, and scenarios

Request: structure a budget-versus-actual spreadsheet and analyze scenarios.
Division: spreadsheet organization normalizes periods/categories; costs explains variances; scenarios calculates alternatives with explicit assumptions. Costs and scenarios depend on a comparable dataset, avoiding mixed periods.
Deliverables: spreadsheet with verified formulas, variance analysis, scenarios, and uncertainties. Review checks formulas, units, and assumptions without approving spending.
Reuse: agent maintaining the model and its context; open a new session with the same identity when the previous one is unavailable. Create another worker only for distinct capacity/role; working on the task does not require changing teams. If the user also requests reorganization, propose a valid composition or requested profile copy without carrying over internal history.
Proposal: “Reuse the model owner for the dataset; a cost analyst explains variances; scenarios starts after checking. The delivery is analysis, not budget execution.”

## Market: competitors, segments, and synthesis

Request: assess an opportunity in a defined segment and region.
Division: competitors surveys offerings/sources; segments analyzes needs and demand signals; synthesis cross-references evidence, limitations, and hypotheses. Research can run in parallel with a common focus; the conclusion depends on both.
Deliverables: comparison with sources/dates, substantiated segments, and synthesis with uncertainties. Do not turn a hypothesis into a fact or conclude based solely on the number of sources.
Reuse: researcher with relevant history and accessible sources; create an independent session when the focus requires separate context. The leader can consolidate without creating an agent solely for synthesis.
Proposal: “Reuse the competitor researcher; open a session for segment analysis; I will consolidate when I receive both. Approval covers these two workstreams, without external customer contact.”

## One request across boards

Precondition in a new chat: if the skill is loaded and the panel opens but Bee Team tools are missing, the leader identifies the MCP URL and prepares authorized registration according to the Codex reference. Then confirm reading through the session tool before querying/recording the request. If registration already exists and only this chat has not been refreshed, reuse the connection and guide a supported refresh/new session; do not start another API. A worker without access reports the gap without repeating global configuration.

Market analysis may produce a financial subtask on another board, executed by another agent. Preserve the research's `rootTaskId`/`originBoardId` and consult the financial task: origin `standard` requires its individual flag, even if the parent research is automatic. Origin `automatic` covers the chain; origin `manual` requires approval. Do not change the financial board's settings. The brief carries the task's objective, sources, decisions, and limits; it does not copy the researcher's internal history. Author/executor are explicit and the relationship between tasks does not require them to belong to the same team.

## Chats and two confirmations

Candidates by name/context are evidence, not proof: gather the reuse/new choice in a single proposal, including in automatic. Handoff explicitly requires Worker use; confirm identity/profile and then understanding of the actual assigned task. Without a task, await registration/assignment. Do not create additional chat–agent persistence.

## Example of a question, decision, and delivery

When an endpoint changes, the Worker saves the full question in a comment and notifies task, area “comment”, and returned commentID. The Leader reads that ID via MCP and the current task; updates specification/plan if necessary, saves the full response/decision in a new comment, and notifies only task, areas actually updated, relevant status, and new commentID. The Worker reads that comment and current state, executes the assigned scope, saves relevant files/evidence, synthesis, and state, then a complete comment on done/not done and pending items. Notify only after confirming everything. Pending human validation does not become Done. A repeated notification or acknowledgment without a contribution does not generate a new comment/notification.

## Role marker in the chat title

Resolve your persisted agent identity, actual team and active role before setting your own chat prefix. If only a team slug is known, use resolveTeamSlug, then getTeam with its UUID. Read roleIcons.leader.unicode or roleIcons.worker.unicode from that team; discover the closed catalog with listTeamRoleIcons (HTTP GET /api/v2/team-role-icons). An agent may have different leader and worker team bindings: use the team for the active role, never infer it from a title or task ownership. Store no SVG or icon configuration in chat metadata. Legacy teams resolve to crown (👑) and user-round (👤); existing chat titles are not automatically migrated. If no team is assigned or lookup is unavailable, retain the conventional fallback 👑 for Leader or 🐝 for Worker, explicitly report that the team selection could not be resolved, and retry lookup on resumption without blocking authorized work.

Read your current title and discover the actual harness rename tool. Normalize only known leading role markers from the catalog, the previous selected marker, and legacy 👑/🐝/star markers that are identifiable as role prefixes, then prepend exactly one selected Unicode prefix. Preserve the useful title, other content and non-role emojis; do not remove matching symbols elsewhere. If already correct, do not write. On a team/role/icon change, replace the old prefix instead of accumulating markers. Rename only your own existing chat. Read back the title when supported and compare the exact expected value; claim verified renaming only after successful readback. If rename or readback is absent/fails, report that concrete limitation honestly; a successful write without readback is not verified.

When creating an explicitly authorized new Worker chat, use the actual destination team's resolved worker Unicode plus the worker name and useful context. The Worker resolves identity/team/role and ensures its own title when taking over. Search/reuse may normalize known leading markers but never treats a title or icon as identity. Preserve existing reuse confirmations and harness permissions; never rename someone else's existing chat or bulk-rename chats.

The change applies exclusively to your own chat title when assuming the role, or to the initial title of the new chat whose creation was authorized. Do not rename other chats in bulk or change agent/team names, slugs, or Bee Team data. Marking the role does not confirm identity or waive a registered/assigned task. The Worker still does not navigate the user's screen; adjusting its own title is not panel navigation.

Examples with a team configured as leader=rocket and worker=shield: after resolving that team, `👑 Ana — Project X` becomes `🚀 Ana — Project X` for its Leader; `🐝 Ana — Project X` becomes `🛡️ Ana — Project X` for its Worker. A repeated invocation with the correct title performs no write. Changing the configured icon is observed on the next lookup; it does not authorize renaming other chats.


## Execution question

The Worker needs to decide the endpoint's error behavior: record the full question and alternatives in the comment, do not open request_user_input or ask the human. If already authorized independent tests can be executed, continue that part; only mark a blocker when necessary. The Leader reads comment/task and responds or records question/options in the task and notifies the human by reference without an interactive dialog; wait for an authorized response, persist the decision, and return a taskID/areas/relevant status/commentID notification. The Worker reads the response by ID via MCP before implementing. Mandatory tool approval continues to be respected.

Delivery reports, confirmation requests, and alternative choices follow the same route: the Worker records substantive content in a comment and notifies the Leader only through metadata; do not report or request confirmation directly from the human. When a human decision is needed, the Leader records question/options in a comment and notifies by reference, without an interactive dialog; wait for an authorized response, persist the feedback, and notify. A legitimate user metainstruction or mandatory tool approval is not bypassed by this rule.

During authorized creation of a new Worker, follow [bootstrap](worker-bootstrap.md): first the chat, then registration/membership by the Worker itself and a response with real name/IDs/readiness; only then does the Leader assign work. Example names are not persisted profiles.
