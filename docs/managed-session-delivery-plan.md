# Managed session delivery implementation plan

Authorized scope: remaining stages of task `01a1b328-0c58-7481-bad1-d9ed03f1319a`, after PR #65's declared-binding slice. Deliver for review without merging. Preserve the original database and all existing bindings/history.

## Implementation sequence

1. Prove the official Codex App Server protocol with two owned test threads, isolated working directory, distinct inputs, process restart and resume. Generate schemas from the installed version. Record acceptance separately from a successful handshake.
2. Add a provider-neutral DTO/event contract and a local Codex stdio adapter in repositories. The adapter resumes only the explicit thread, verifies its project root and preserves its permission policy. Claude Code reports unsupported until a future adapter is implemented. Test malformed responses, missing sessions, process loss, approvals and timeout.
3. Add a durable delivery ledger through additive migrations for both databases. Enqueue mentions transactionally with Conversation comments; snapshot the binding and recipient. Never resolve by display name or promote legacy chat references. A changed binding invalidates a queued destination. Sending runs outside database transactions, with acknowledgement and final response recorded separately. A crash after dispatch is uncertain and is never blindly resent.
4. Enqueue one Conversation notice to the board team's leader for each worker-authored execution summary. Suppress leader-authored summaries. Use source IDs and recipient IDs for uniqueness, including compound MCP writes and request replay. Correlate provider responses to the originating comment; response notifications do not recursively trigger more responses.
5. Expose delivery state through shared HTTP/MCP reads. Enable local dispatch only through explicit installation configuration. Preserve unmanaged skills/MCP behavior. Validate restart, two recipients, failed/unknown deliveries, session replacement, duplicate requests, leader suppression and legacy transfer archives. Update README, changelog and catalog; build/test, review and publish commits to the open PR.

## Boundaries and decisions

- Services own destination resolution, lifecycle and notification rules. Repositories own local child-process I/O and persistence. Routes remain transport-only.
- Conversation is the only managed message channel. Authored Markdown is preserved as text. A binding only declares a destination; provider acceptance and completion are separate evidence.
- Local configuration selects the executable and installation, never request bodies. No credentials enter Bee Team records. No messages target the user's existing conversations during acceptance testing.
- Tokens by task/agent/binding remain phase 2. Workflow snapshots remain actual session metrics, never fabricated task consumption.
- Provider uncertainty trades automatic retries for explicit reconciliation, preventing duplicate generation. Delivery is not exactly-once inference.

## Evidence ledger

- 2026-11-07: CLI 0.166.0 generated schemas and completed initialize/initialized. Two owned sessions completed distinct first turns and returned their own marker after App Server restart/resume. Missing-thread resume rejected. Evidence is under `D:/codex-build-cache/app-server-proof/`.
- Session execution start and handshake checkpoint are persisted on subtask 3 in the evaluation database. Original database is untouched.

Ruling: managed summary notifications require an active explicit binding for the worker author. This preserves the unmanaged skills/MCP path; an unbound leader remains an explicit pending recipient.
Ruling: validate the effective per-thread MCP inventory and pin the full current-instance URL before inference. Overrides are ephemeral and never rewrite global Codex configuration.
