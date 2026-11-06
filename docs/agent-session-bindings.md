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

Proposed shared HTTP/MCP operations:

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

Acceptance for this slice: HTTP/MCP parity, idempotent replay, cross-project and
cross-provider replacement history, stale/ABA conflicts, concurrent claims,
duplicate session ownership, rollback, legacy references and archived agents in
isolated SQLite and PostgreSQL. Preserve transfer snapshots and old data. A
Codex proof must use the official App Server, not a community client crate.

Implementation is delivered through an open draft PR to main for user review;
merging and activation are separate actions.
