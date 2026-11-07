# Managed Conversation delivery

The first binding slice and this delivery slice remain reviewable changes on PR #65. A saved binding declares a destination; successful provider acknowledgement and completion are separate events.

## Local activation

Managed sending is disabled unless `BEE_SESSION_INSTALLATION_ID` is explicitly set. Also set:

- `BEE_CODEX_EXECUTABLE`: absolute path to the official Codex executable, not a shell command, npm wrapper or SDK.
- `BEE_SESSION_STATE_DIR` (optional): absolute directory for OS-backed installation leases. The default is `.beeteam/managed-session-locks` under the user's home.

The configured installation must match the explicit session binding. Codex handles its existing authentication; Bee Team never reads or stores credentials. Each resumed thread retains its saved model, sandbox and approval policy. Its actual project directory must match the binding. Unknown server requests and approvals are not automatically granted; continue them in the owning harness. Claude Code is represented by the provider-neutral contract but returns unsupported until a future official adapter is implemented.

Use a separate test database and owned test sessions before activation. Never infer managed ownership from legacy chat references or profile names. The existing MCP binding operations remain the only way to create or explicitly replace an active binding; history is preserved. Do not run the same managed thread concurrently through another harness process.

## Conversation and HTTP/MCP

Type `@` in the task Conversation and select an agent from the board's team. Selection inserts a profile link and persists the stable agent ID. Names, text that merely looks like a mention, and Markdown links copied without selecting a recipient never choose a destination automatically.

HTTP `createComment` and its MCP counterpart accept:

```json
{"body":"Please inspect this change.","mentionedAgentIds":["<persisted-agent-uuidv7>"]}
```

Use the current task version and the same idempotency key/body/version when retrying an uncertain HTTP result. Each recipient has an independent delivery record. `listTaskSessionDeliveries` / `GET /api/v2/tasks/{taskId}/session-deliveries` supports `commentId`, `state`, offset and limit. A recipient without a binding waits for an explicit binding; a recipient from another team rejects the whole comment mutation. No provider call occurs inside a database transaction.

The worker's final response is appended to the same Conversation with `inReplyToCommentId` and `deliveryId`. An informational delivery returns it to the requesting agent's original binding only if that binding remains active. It does not notify another worker or recurse into an acknowledgement loop. Human requests receive their responses in the Conversation. Authored Markdown is preserved as text.

For every summary authored by an explicitly bound worker belonging to the task board's team, including intermediate and final summaries, the same transaction inserts a Conversation notice linked by `sourceSummaryId` and queues it for that team's leader. A leader-authored summary generates no notice. The source summary ID and recipient make the intent unique. Shared HTTP/MCP execution, `close_activity` and saved idempotent replays retain these guarantees. A failed summary transaction creates neither a notice nor a delivery.

## Delivery and recovery states

| State | Meaning and recovery |
| --- | --- |
| waiting_binding | No managed destination existed. Wait for an explicit binding. |
| pending | Destination recorded; no send claimed yet. |
| dispatching | Serialized claim committed before provider I/O. |
| acknowledged | Provider returned the exact turn ID; generation is still pending. |
| completed | Matching `turn/completed` reports completed; the correlated reply, if requested, is committed. |
| failed | Provider was unavailable before dispatch, or rejected an unsupported destination. Inspect and issue a new explicit message after correcting the cause. |
| uncertain | Timeout, connection loss, approval boundary or restart left an unconfirmed outcome. Never automatically resend; inspect the original session first. Further sends on that binding wait for intervention. |
| superseded | The recorded binding or team membership changed before dispatch. No fallback to a previous or replacement session. |

An exclusive OS lease prevents two local services from dispatching/recovering the same installation. Two independent session workers progress concurrently; each binding is serialized. On service restart, in-flight records become uncertain while retaining the provider turn ID when known. Exactly-once inference is not promised by the provider protocol. After inspecting an uncertain session, an explicit binding replacement to a verified destination can resume new work; it does not erase the uncertain history or prove that the original action was cancelled.

## Acceptance evidence

On 2026-11-07, official CLI 0.166.0 generated its own schemas and completed the documented initialize/initialized handshake over stdio. Two newly created owned test threads completed distinct marker turns. After terminating and restarting App Server, both resumed by the same IDs and returned their own markers without cross-talk; a missing thread was rejected. The Rust adapter separately returned Accepted and Completed for the owned ALPHA thread. Sanitized evidence is in [the acceptance record](evidence/managed-session-proof-20261107.json).

Run `cargo test --locked --test codex_session_protocol --test managed_session_queue --test managed_session_dispatch` with each isolated test driver. The explicit real-provider probe is `cargo run --locked --example codex_session_probe`, requiring `BEE_CODEX_EXECUTABLE`, `BEE_PROOF_THREAD` and `BEE_PROOF_ROOT` for an owned test thread. It makes a real inference request and is never part of the automatic test suite.

Session workflow token snapshots are not product usage attributed to tasks or deliveries. Product token accounting remains phase 2. Code, automated tests, real-provider evidence, local UI evaluation and user acceptance remain separate delivery states.

Protocol reference: [official Codex App Server documentation](https://learn.chatgpt.com/docs/app-server). The real busy-session probe on CLI 0.166.0 accepted a second turn/start into the same active turn; Bee Team therefore serializes its own sends and does not treat provider rejection as its concurrency guarantee. The test then interrupted that owned turn and observed interrupted, never completed.

Managed MCP routing is pinned to the originating local instance, including its exact MCP path. Before inference, the adapter inventories all server pages, applies per-thread overrides to disable inherited MCP servers/plugins, and verifies the effective thread inventory and current server origin/catalog. Unverified or conflicting routing fails before turn/start. Dynamic unrelated plugins are also disabled for the managed turn. This is routing containment, not a new authentication or filesystem sandbox boundary; the saved model, sandbox and approval policy remain in force. Global Codex configuration is never written.

Workers without an active explicit binding retain their unmanaged skills/MCP notification flow: their summaries do not create managed notices or a future delivery backlog. A bound worker can still notify an unbound leader through a waiting_binding record.

Reproduce the opt-in real flow with `python scripts/qa-managed-sessions.py --beeteam <candidate> --codex <official-native-codex> --output <temporary-parent>`. This creates owned test threads and a fresh isolated SQLite database, makes real inference requests, and records measured counters for its own sessions. The one-thread Rust probe also requires BEE_PROOF_MCP_URL for the intended running test instance.

The model-driven MCP canary additionally cloned only owned test fixtures (including their IDs) into a second isolated instance and injected that wrong endpoint into the official Codex process through the acceptance-only passthrough example. The model called getTask/createComment against the current instance; every table hash of the canary remained unchanged. A fresh unmanaged resume retained the original policy and MCP setup. See [MCP canary evidence](evidence/managed-mcp-canary-20261107.json) and [full real-flow evidence](evidence/managed-conversation-e2e-20261107.json). Reproduce with `python scripts/qa-managed-mcp.py --beeteam <candidate> --codex <native-codex> --shim <compiled-codex_mcp_canary-example> --output <temporary-parent>`. Build the shim with `cargo build --locked --example codex_mcp_canary`; it is acceptance instrumentation, never the production runtime.
