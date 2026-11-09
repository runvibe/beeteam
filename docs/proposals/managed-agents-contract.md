# Bee Team-owned agents: contract v1

Status: implemented on the review branch. HTTP/MCP adapters, shared services, additive persistence and the side panel use these contracts. Explicit agent configuration enables the managed path; the global legacy cutover remains pending as described below. No main merge or release is authorized.

## Decisions for parallel implementation

- Keep ordinary agent creation (`createAgent`, POST `/api/v2/agents`) and profile editing in the RA contract. They already prohibit unknown session fields. Creation does not launch a provider or grant runtime access. Configure an existing agent using `configureAgentExecution`; profile creation and configuration are intentionally two operations, so a configuration failure leaves a valid, visibly unconfigured agent.
- Configure provider/project/tools only. Provider thread, binding, installation and process identifiers never appear in public request schemas. The only initial provider is Codex; the adapter boundary remains extensible without accepting unsupported provider names.
- Prepare the owned runtime on the first accepted request. Configuration does not imply login readiness or successful execution. Request state exposes preparation failures. The owned provider thread is created on the first accepted request.
- An agent owns multiple Bee Team conversations. Each conversation owns its provider context internally. One active provider turn per agent in v1; conversations queue behind that lease. Separate conversations must not silently share a provider thread. A conversation is an explicit context-sharing choice, not a privacy boundary.
- The local application is currently a trusted single-user installation. No caller authentication or tenant isolation is invented. Transport labels, actor fields and IDs are metadata, never credentials or authorization. HTTP/MCP execution retains the existing direct-local boundary. Hosting/multi-user access requires a separate security design.

## HTTP/MCP mapping

The OpenAPI is the source for request and response schemas. `managed-agents-mcp.json` is a proposed, deliberately unadvertised catalog. The validator verifies exact body/response parity, fixtures and generated TypeScript.

| HTTP operation | Proposed MCP tool | Contract |
| --- | --- | --- |
| GET agent execution-config | getAgentExecutionConfiguration | readiness, configuration or null, agent version |
| PUT agent execution-config | configureAgentExecution | full configuration replacement, If-Match agent version |
| POST agent requests | sendAgentRequest | content, optional Bee Team conversation and task |
| GET agent requests | listAgentRequests | bounded cursor pagination |
| GET agent conversations | listAgentConversations | bounded cursor pagination |
| GET agent-request | getAgentRequest | consistent snapshot with messages, approvals and cursor |
| GET conversation messages | listAgentConversationMessages | bounded message history |
| POST request cancel | cancelAgentRequest | targeted cancellation, If-Match request version |
| POST request reconcile | reconcileAgentRequest | inspect the original accepted work, never repeat inference |
| POST approval decision | decideAgentRequestApproval | accept/decline one approval, If-Match approval version |
| GET request events | none; MCP polls snapshot | SSE notifications and reconnect cursor |

Path IDs are UUIDv7 Bee Team IDs. Configuration PUT uses the **agent version**, even when the configuration is null. ConfigurationState.version always denotes that same resource version; configurationVersion in conversations/requests pins the accepted version and is immutable. Shared writes require an Idempotency-Key; MCP uses `idempotencyKey` and `expectedVersion` for If-Match. Read tools have neither field. MCP outputs wrap the HTTP body as `{data: ...}`. No body is accepted for cancel/reconcile.

## Submission, origin and context

POST accepts at most 65536 UTF-8 bytes, nonblank and without NUL. DTO validation and the schema validator both enforce bytes, including emoji. Project/skill paths are absolute host paths, at most 4096 UTF-8 bytes without NUL/newlines/surrounding whitespace; filesystem existence/allowed-root checks belong to the service, not DTO parsing. Tool profile contains only configured MCP names, no credentials, arbitrary executable or server URL.

Omitted or null conversationId creates a new Bee Team conversation for this request. Same idempotency key never creates a second conversation. Supplying conversationId continues that exact agent's conversation; another agent's conversation returns 409 conversation_mismatch. Omitting taskId on continuation inherits its existing task. Supplying a different task (including linking a previously unlinked conversation) returns 409 conversation_mismatch: start a separate conversation to change task context. No send creates a task, changes assignment, or changes team membership.

The service verifies agent/task existence, active state and applicable team/task context using current domain rules. It does not silently claim the caller as the executor. Public input cannot set `origin.transport`; the receiving adapter records http or mcp. Conversation/summary_notice origins are generated only by trusted internal orchestration, not caller fields. Origin labels are diagnostic metadata, not authenticated identities.

Replies belong to the request and its conversation. Each message has immutable requestId, conversationId and role. A requester message is not a worker-authored execution summary. External callers consult by the returned request ID; no push to Desktop and no claim that the external harness is controlled. Requests to workers do not grant configuration or approval permissions. Existing authorization/boundary checks apply independently to configure, cancel and decide.

## Queue, snapshots and idempotency

Submission durably records a request and returns 202 with its current state; acceptance is not provider delivery. Terminal execution failures are read as 200 snapshots with failed state/error, not mistaken for submission HTTP errors. Acceptance requires a configured active agent; unconfigured submission returns 400 invalid_request with an actionable message and creates no request. Authentication/provider availability is checked during preparation, yielding explicit failure if unavailable.

V1 permits one active turn per agent and at most **32 pending nonterminal requests** (including the active/uncertain request). Admission and capacity check are atomic. Pending order is durable acceptance sequence, with UUIDv7 as tie-breaker; no per-caller quota is claimed without authenticated callers. Full queue returns 429 queue_full with Retry-After seconds. Polling, reconnects, retries and approved duplicate notices do not change queue position or start extra work.

Idempotency scope is installation + operation + resource + key, retained with the durable request or mutation journal (no time expiry within v1). Compare a canonical body: whitespace in content is preserved; omitted/null optional IDs normalize to the same meaning; configuration lists preserve supplied order. A changed body returns 409 idempotency_conflict. For a matching replay, return the stored original response/status before rechecking its stale If-Match, never rerun the mutation; use GET for the current state. An unknown submission receipt is retried with the same key and body only. A new key must not be suggested until the old outcome is known.

Snapshots use one repository-owned read snapshot and return the latest 50 messages in ascending creation sequence, plus pending approvals and a cursor at the snapshot boundary. MessagePage.nextCursor loads older pages, also ascending within a page. List request/conversation pages are newest-first by creation sequence, stable tie-breaker ID, default 50 and max 100. Cursors are opaque, scoped to resource/filter/order; malformed or foreign cursors return 400 invalid_request. New messages do not invalidate older-history cursors. Lists expose no invented per-caller access separation.

SSE events contain RequestEvent with monotonically ordered opaque cursor and current request revision. Message/tool-output changes also advance the request revision and emit request.updated; clients fetch the snapshot to reconcile message revisions. Heartbeats carry no event ID. Reconnect passes Last-Event-ID; retained events replay after that cursor. Expired cursors return 410 cursor_expired before SSE headers, or snapshot.required if the stream is already open. Client fetches a snapshot and reconnects from its cursor. Fetch snapshot/subscribe race is covered by retained replay; do not restart inference to repair a stream.

## State machine and recovery

`accepted -> queued -> preparing -> running -> completed` is the usual path; idle execution can skip queued. running may enter awaiting_approval and resume running after a valid accept. Decline ends failed with an explanatory error. Preparing/running may enter failed or uncertain. Cancel of accepted/queued work immediately becomes cancelled. For active work cancellation is a request to the original provider turn: state remains active until confirmation and becomes uncertain if confirmation is lost. Do not report cancelled merely because a signal was sent.

Uncertain is nonterminal and occupies the agent lease. Reconciliation can observe preparing/running/awaiting_approval/completed/failed/cancelled, but never enqueues or resends inference. Unknown creation with no provider thread/turn identity remains uncertain; it cannot be guessed from recent Desktop chats. Completed/failed/cancelled are immutable terminal outcomes. Request updates and replies/summary notices commit atomically; retries cannot duplicate them.

Approval decisions address the approval ID and version, not whichever chat/turn is currently visible. Pending approval must resolve to its original request/agent/owned provider operation. Unsupported structured/OAuth approval fails explicitly; no accept_all. Expired/already decided conflicting writes return 409 approval_expired; stale version returns 412 version_conflict. Same idempotent replay returns its stored response.

## Reconfiguration and legacy rollout

Configuration replacement is rejected with 409 configuration_busy while **any** pending/active/uncertain request exists for the agent. Equal configuration is an idempotent no-op. A changed configuration creates a new configuration generation and makes existing conversations read-only for new sends, without changing historical messages; a new conversation uses the new generation. A send against the prior generation returns 409 configuration_changed. No accepted turn is silently moved to another provider or project.

The cutover is guarded by capability **agents.managed-requests.v1**, advertised only after service, migrations and compatibility tests ship together. This slice does not add that capability to `/info`. The first release advertising it removes write behavior of createAgentWithSession, claimAgentSession, createIntegratedSession, createChatReference and updateChatReference, plus old binding-dependent leader-chat writes. Legacy HTTP writes return 410 operation_removed without mutation; legacy MCP calls return the matching structured domain error. They cannot auto-convert to owned execution. Old read endpoints remain read-only for history until a separately announced removal; new panels never use them as proof of execution readiness.

Ordinary createAgent, profile edits, team membership and history retain their contracts. Existing **owned** provider sessions are migrated only with proven creation provenance. External IDs become historical references, not runnable sessions. Cutover drains known work or blocks; uncertain operations must remain reconcilable through a compatibility path before disabling old writes. No destructive migration is part of this contract slice.

HTTP errors: 400 validation, 403 local boundary, 404 missing resources, 409 semantic/idempotency/configuration conflicts, 410 removed operation/expired cursor, 412 stale version, 413 byte limit, 428 missing required concurrency/idempotency headers, 429 capacity, 503 unavailable service, 500 unexpected internal failure. User-facing errors must not include credentials, provider transcripts or private process paths beyond configured project references.

## Inventory of affected consumers

| Current source | Migration obligation |
| --- | --- |
| docs/ra-openapi.yaml: createAgentWithSession, claimAgentSession, chat-reference writes | cutover tombstones; preserve history and normal createAgent |
| src/dto/session_bindings.rs; services/backend/session_bindings.rs; services/backend/ra.rs | keep ownership internal; reject new external association at cutover |
| src/dto/leader_chat.rs; integrated_chat_tools.rs; docs/proposals/integrated-chat-* | remove public binding selection in replacement contracts, preserve old read snapshots |
| src/services/leader_chat/{bootstrap,execution,recovery,worker_delivery}.rs | server-owned context, generation, queue and exact-turn recovery |
| src/services/managed_sessions/{queue,dispatch,completion}.rs | route canonical Conversation/summary notices into the same owned request service |
| frontend/src/api/leader-chat*; features/use-leader-chat.ts | adapt transport to requests/snapshots without external IDs |
| frontend/src/features/leader-chat.tsx | remove replace-binding form; configure runtime and send request |
| frontend/src/features/chat-side-panel.* | retain navigation, draft, sizing and left/right preference |
| skills and resources/bee-team source/bundled snapshots | replace assume/rebind guidance, regenerate provenance and catalog at runtime cutover |
| tests/session_mode_contract.rs, leader_chat_http.rs, worker_delivery.rs and frontend chat tests | preserve legacy reads; add cutover, idempotency, multi-conversation and recovery acceptance |

The runtime checkpoint below supersedes the original contract-only status.

## Runtime implementation checkpoint

HTTP/MCP requests, owned per-conversation execution, durable per-agent queue, snapshots/SSE and the side panel are implemented on the review branch. The migration is additive. Explicitly configuring an agent switches that agent to managed requests and rejects its legacy bind/bootstrap writes; other legacy agents remain compatible until the global cutover is accepted. The final `agents.managed-requests.v1` capability is intentionally withheld during that transition. This staged retirement supersedes the all-at-once proposal above for the review build, preserving existing in-flight work. Existing owned sessions remain readable in legacy history, rather than being silently assigned to a new conversation.

Provider output uses the same UTF-8-safe 65536-byte display bound during streaming and reconciliation, with an explicit truncation notice; the original turn is still consumed through its terminal outcome. Managed mutation receipts remain durable without the legacy 24-hour expiration.
