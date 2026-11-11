# Managed Conversation delivery

The first binding slice and this delivery slice remain reviewable changes on PR #65. A saved binding declares a destination; successful provider acknowledgement and completion are separate events.

## Two coexisting session modes

The external workflow remains available: use the user's existing assistant with MCP and the role skills. A saved external chat ID is metadata, not a remotely controllable session. The agent reads its assigned task's Conversation when activated and records its response there. If the harness has a supported, explicitly authorized notification tool, that workflow can still use it. Otherwise the message remains available for the external agent to read; do not label it as delivered to the session.

Integrated mode uses a session owned by Bee Team and the official provider adapter. The human-facing leader chat is separate from task Conversation: it can begin before any task exists, while task Conversation remains the canonical exchange between leader and workers. A team can mix external and integrated agents. Delivery follows the recipient's mode. Each agent has one active binding, and an explicit replacement preserves history rather than taking over a Desktop-owned session.

Check the installed runtime's advertised capabilities and binding mode. Older binaries without that capability keep the external workflow. Provider acknowledgement, response completion and human acceptance are separate milestones. The integrated-chat contract and implementation work must not be presented as released merely because the skills have been updated.

## Local activation

Managed sending is disabled unless `BEE_SESSION_INSTALLATION_ID` is explicitly set. Also set:

- `BEE_CODEX_EXECUTABLE`: absolute path to the official Codex executable, not a shell command, npm wrapper or SDK.
- `BEE_SESSION_STATE_DIR` (optional): absolute directory for OS-backed installation leases. The default is `.beeteam/managed-session-locks` under the user's home.

The configured installation must match the explicit session binding. Codex handles its existing authentication; Bee Team never reads or stores credentials. Each resumed thread retains its saved model, sandbox and approval policy. Its actual project directory must match the binding. The legacy Conversation adapter does not automatically grant unknown server requests or approvals. Integrated chat must route supported approvals through its own panel; an unsupported request is reported explicitly, never silently accepted. Claude Code is represented by the provider-neutral contract but returns unsupported until a future official adapter is implemented.

Use a separate test database and owned test sessions before activation. Never infer managed ownership from legacy chat references or profile names. Use the installed runtime's explicit binding or integrated-session creation flow; history is preserved. Creating a managed session is a separate operation from saving an external chat reference. Do not run the same managed thread concurrently through another harness process.

## Conversation and HTTP/MCP

Type `@` in the task Conversation and select an agent from the board's team. Selection inserts a profile link and persists the stable agent ID. Names, text that merely looks like a mention, and Markdown links copied without selecting a recipient never choose a destination automatically.

HTTP `createComment` and its MCP counterpart accept:

```json
{"body":"Please inspect this change.","mentionedAgentIds":["<persisted-agent-uuidv7>"]}
```

Use the current task version and the same idempotency key/body/version when retrying an uncertain HTTP result. Each recipient has an independent delivery record. `listTaskSessionDeliveries` / `GET /api/v2/tasks/{taskId}/session-deliveries` supports `commentId`, `state`, offset and limit. A recipient without a binding waits for an explicit binding; a recipient from another team rejects the whole comment mutation. No provider call occurs inside a database transaction.

For an external recipient, `waiting_external` is a delivery-ledger observation, not an acknowledged inbox. The current API has no external consume/acknowledge operation. The agent reads the task Conversation with the existing tools and writes its response there; that comment does not automatically complete the managed receipt. Changing the agent to integrated mode does not automatically replay old `waiting_external` messages. Issue a new deliberate request when delivery is required under the new binding.

The worker's final response is appended to the same Conversation with `inReplyToCommentId` and `deliveryId`. An informational delivery returns it to the requesting agent's original binding only if that binding remains active. It does not notify another worker or recurse into an acknowledgement loop. Human requests receive their responses in the Conversation. Authored Markdown is preserved as text.

For every summary authored by an explicitly bound worker belonging to the task board's team, including intermediate and final summaries, the same transaction inserts a Conversation notice linked by `sourceSummaryId` and queues it for that team's leader. A leader-authored summary generates no notice. The source summary ID and recipient make the intent unique. Shared HTTP/MCP execution, `close_activity` and saved idempotent replays retain these guarantees. A failed summary transaction creates neither a notice nor a delivery.

## Delivery and recovery states

| State | Meaning and recovery |
| --- | --- |
| waiting_binding | No managed destination existed. Wait for an explicit binding. |
| waiting_external | Recipient is external. The Conversation remains readable; no provider push or automatic delivery acknowledgement is performed. |
| pending | Destination recorded; no send claimed yet. |
| dispatching | Serialized claim committed before provider I/O. |
| acknowledged | Provider returned the exact turn ID; generation is still pending. |
| completed | Matching `turn/completed` reports completed; the correlated reply, if requested, is committed. |
| failed | Provider was unavailable before dispatch, or rejected an unsupported destination. Inspect and issue a new explicit message after correcting the cause. |
| uncertain | Timeout, connection loss, approval boundary or restart left an unconfirmed outcome. Never automatically resend; inspect the original session first. Further sends on that binding wait for intervention. |
| superseded | The recorded binding or team membership changed before dispatch. No fallback to a previous or replacement session. |

An exclusive OS lease prevents two local services from dispatching/recovering the same installation. Two independent session workers progress concurrently; each binding is serialized. On service restart, in-flight records become uncertain while retaining the provider turn ID when known. Exactly-once inference is not promised by the provider protocol. An uncertain integrated turn or delivery blocks new sends, binding replacement and agent archival until its outcome is reconciled. Replacing metadata is not proof that the original provider stopped. Use the explicit chat turn reconciliation action for a known provider turn; it reads that exact turn without resending the request. Confirmed completed, cancelled or failed outcomes release the local reservation. Running, missing or unknown provider outcomes remain uncertain.

## Acceptance evidence

On 2026-11-07, official CLI 0.166.0 generated its own schemas and completed the documented initialize/initialized handshake over stdio. Two newly created owned test threads completed distinct marker turns. After terminating and restarting App Server, both resumed by the same IDs and returned their own markers without cross-talk; a missing thread was rejected. The Rust adapter separately returned Accepted and Completed for the owned ALPHA thread. Sanitized evidence is in [the acceptance record](evidence/managed-session-proof-20261107.json).

Run `cargo test --locked --test codex_session_protocol --test managed_session_queue --test managed_session_dispatch` with each isolated test driver. The explicit real-provider probe is `cargo run --locked --example codex_session_probe`, requiring `BEE_CODEX_EXECUTABLE`, `BEE_PROOF_THREAD` and `BEE_PROOF_ROOT` for an owned test thread. It makes a real inference request and is never part of the automatic test suite.

Session workflow token snapshots are not product usage attributed to tasks or deliveries. Product token accounting remains phase 2. Code, automated tests, real-provider evidence, local UI evaluation and user acceptance remain separate delivery states.

Protocol reference: [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server). The real busy-session probe on CLI 0.166.0 accepted a second turn/start into the same active turn; Bee Team therefore serializes its own sends and does not treat provider rejection as its concurrency guarantee. The test then interrupted that owned turn and observed interrupted, never completed.

Managed MCP routing is pinned to the originating local instance, including its exact MCP path. Before inference, the adapter inventories all server pages, applies per-thread overrides to disable inherited MCP servers/plugins, and verifies the effective thread inventory and current server origin/catalog. Unverified or conflicting routing fails before turn/start. Dynamic unrelated plugins are also disabled for the managed turn. This is routing containment, not a new authentication or filesystem sandbox boundary; the saved model, sandbox and approval policy remain in force. Global Codex configuration is never written.

Workers without an active explicit binding retain their unmanaged skills/MCP notification flow: their summaries do not create managed notices or a future delivery backlog. A bound worker can still notify an unbound leader through a waiting_binding record.

Reproduce the opt-in real flow with `python scripts/qa-managed-sessions.py --beeteam <candidate> --codex <official-native-codex> --output <temporary-parent>`. This creates owned test threads and a fresh isolated SQLite database, makes real inference requests, and records measured counters for its own sessions. The one-thread Rust probe also requires BEE_PROOF_MCP_URL for the intended running test instance.

The model-driven MCP canary additionally cloned only owned test fixtures (including their IDs) into a second isolated instance and injected that wrong endpoint into the official Codex process through the acceptance-only passthrough example. The model called getTask/createComment against the current instance; every table hash of the canary remained unchanged. A fresh unmanaged resume retained the original policy and MCP setup. See [MCP canary evidence](evidence/managed-mcp-canary-20261107.json) and [full real-flow evidence](evidence/managed-conversation-e2e-20261107.json). Reproduce with `python scripts/qa-managed-mcp.py --beeteam <candidate> --codex <native-codex> --shim <compiled-codex_mcp_canary-example> --output <temporary-parent>`. Build the shim with `cargo build --locked --example codex_mcp_canary`; it is acceptance instrumentation, never the production runtime.

## Integrated worker approvals

The integrated Conversation dispatcher uses the same provider and control registry as the leader chat. A worker's approval appears in its team's integrated leader chat with the originating agent, task and binding. Accepting or declining targets that worker turn; it does not resume the leader's turn or silently grant later actions. Conversation delivery and direct human chat turns reserve the same active-binding slot.

If the leader has no integrated chat, a worker can execute actions that do not request approval. An approval request stops delivery with `approval_required` and an uncertain outcome; it is never accepted automatically. Open the appropriate integrated leader chat and inspect the original turn before any explicit retry. Unsupported provider interactions also remain explicit failures.

A Conversation notice addressed to the integrated leader appears as a task-linked system notice in the leader chat. Its response is an assistant message there, while the dispatcher still owns the canonical Conversation reply and prevents acknowledgement loops. Worker text does not masquerade as a human chat message.

`cargo test --locked --test worker_delivery` covers binding reservation, external-mode refusal, origin-specific approval routing and leader notification rendering data using an isolated SQLite database and a controlled provider. This is transport-independent evidence; actual Codex approval behavior and browser acceptance require separate verification.

## Explicit recovery

`POST /api/v2/leader-chats/{chatId}/turns/{turnId}/reconcile` uses declared actor context, the observed turn version and an idempotency key. It accepts an uncertain turn belonging to the original active binding on this installation. Provider inspection occurs outside the database transaction; version and binding are checked again before applying the result. A duplicate request replays the same result. To check a still-unresolved turn again later, send a new explicit request with a new key.

Recovery never starts, resumes or resends inference. Without a persisted provider turn ID, Bee Team cannot safely guess which turn belongs to the request and returns unresolved. A confirmed worker completion applies the original Conversation reply and receipt atomically, without duplicate delivery; a confirmed leader response restores the assistant message. Unknown/running results preserve uncertainty.

Known limits: a worker turn with no integrated leader chat has no address under the leader-chat recovery route. A bootstrap request that lost its provider session ID cannot be safely recovered by choosing an arbitrary provider thread or silently creating a second one. These cases remain explicit unresolved outcomes.
