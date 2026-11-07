# Managed agent session bindings: first implementation slice

This slice records a declared destination. It does not prove the provider can
resume it or deliver messages. Existing chat references remain metadata and are
never promoted automatically. Provider verification, routing, mentions, summary
notifications and product token measurement belong to subsequent slices.

The managed binding ledger has its own persistence records and history. At most
one binding is active for an agent across projects/providers/installations, and
one `(harness, installationId, externalId)` can belong to one active agent. Keep
ended rows with start/end, declared actor and original destination. New writes
use the existing serialized repository UnitOfWork and idempotency protocol;
database partial unique indexes also enforce both active invariants.

| Data | Origin and guarantee | What it does not prove |
| --- | --- | --- |
| Existing ChatReference harness/externalId/label/optional URL | Existing client-authored metadata, retained unchanged | Active ownership, access or resumability |
| Managed harness/installationId/externalId | Explicit claim; unique active destination in both databases | Provider process, authentication or session availability |
| Managed projectRoot | Declared absolute Windows/POSIX root, never traversed by this slice | Filesystem permission or provider-confirmed working directory |
| Binding agentId and ID | Persisted UUIDv7; one active binding per agent across all projects/harnesses | Identity authentication of the declared actor |
| startedAt/endedAt, startedBy/endedBy | Transactional lifecycle history and declared authorship | Message delivery, acknowledgement or token consumption |

Profiles are never selected or reused merely because names match. The caller
explicitly creates a new profile or chooses an existing available agent.

Shared HTTP/MCP operations in this implementation slice:

- `createAgentWithSession`, POST `/api/v2/agents/with-session`: `{agent, session}`.
  Creates the profile and binding in one transaction; duplicate destination rolls
  back profile/slug allocation and idempotent replay retains the response.
- `claimAgentSession`, POST `/api/v2/agents/{agentId}/session-binding`:
  `{session, expectedBindingId}` with task-independent agent `If-Match` and
  idempotency key. `expectedBindingId:null` claims an available agent; an occupied
  agent requires the exact observed active binding UUID, explicitly replacing it.
  A replacement closes the old binding and opens another atomically. Stale
  versions and stale binding IDs reject without modifying either destination.
- `listAvailableSessionAgents`, GET `/api/v2/agents/available-for-session`: active
  profiles with no active managed binding, filtered and paginated in the database.
- `listAgentSessionBindings`, GET
  `/api/v2/agents/{agentId}/session-binding/history`: paginated active/ended ledger.

`session` contains `harness` (`codex` or `claude-code`), opaque installation ID,
opaque external session ID and absolute project root. IDs are metadata, never
commands or authentication. Records report verification `declared` until a later
provider operation establishes capability. Never treat the session ID as an
agent/team/task UUID. No automatic message may resolve an ambiguous destination.

| Conflict/recovery | Result |
| --- | --- |
| Agent already occupied, expectedBindingId null | Conflict; caller must explicitly choose replacement |
| Stale agent version | 412; reread agent and binding before a new request |
| Stale binding ID, including an ABA switch | 409; no implicit replacement |
| Destination active on another agent | 409; new profile creation rolls back too |
| Exact saved idempotency replay | Original response snapshot, without a second history row |
| Storage failure before commit | Whole mutation and replay roll back |
| Uncertain transport outcome | Retry the same key/body; do not invent a new operation |
| Provider access/resume unavailable | Still declared metadata; no sending is attempted by this slice |

Acceptance for this slice: HTTP/MCP parity, idempotent replay, cross-project and
cross-provider replacement history, stale/ABA conflicts, concurrent claims,
duplicate session ownership, rollback, legacy references and archived agents in
isolated SQLite and PostgreSQL. Preserve transfer snapshots and old data. A
Codex proof must use the official App Server, not a community client crate.

Implementation is delivered through an open draft PR to main for user review;
merging and activation are separate actions.

Archiving an agent through the existing permitted lifecycle closes its active binding in the same transaction. Restoring the profile does not silently reopen a session. Legacy transfer archives without the new ledger group remain accepted as an empty ledger, preserving the original archive and manifest bytes.
