# Linking existing tasks

`POST /api/v2/tasks/{taskId}/parent/link` and MCP `linkTaskToParent` share DTO
validation, the application service and one serialized repository transaction.
The legacy `/api/v1` facade also exposes the operation. This does not move tasks
between boards or recreate them.

Supply the task's `If-Match`, an `Idempotency-Key`, declared actor headers and:

```json
{
  "parentId": "10000000-0000-7000-8000-000000000001",
  "parentVersion": 4,
  "coordinationContext": {
    "mode": "manual",
    "conversationRef": "existing-conversation",
    "approvalRef": "actual-approval"
  }
}
```

If the task already has a parent, supply that parent's current version in
`previousParentVersion`; omit it for a root task. Detaching to `null` is outside
this operation. Changing `parentId` through PATCH remains invalid.

## Current context and history

The task keeps its ID, slug, board, status, position, author, executor, individual
autonomy setting, progress, block, specification, current summary and work scope.
Plans/revisions, comments, attachments and bytes, execution summaries, usage and
interval evidence, and saved idempotent responses remain unchanged. The existing
subtree moves together. Only its root's direct `parentId` changes; all subtree
tasks receive the new ancestry's current `rootTaskId` and `originBoardId`.

Every affected task and both distinct direct parents increment their versions.
One `task.parent_changed` audit event is appended to each subtree task, recording
the linked task, previous/new direct parent, previous/current execution context
and declared coordination evidence. Clients must reread affected parents and
descendants before further versioned writes. Historical summaries retain their
original context. Subsequent summaries must use the new current context, or receive
`execution_context_mismatch`.

## Approval and conflicts

Coordination must be manual when the old parent, new parent, or any subtree node
requires manual coordination before **or** after the move; otherwise automatic.
Manual coordination requires the existing approval reference fields. These remain
declared metadata, not authentication. No persisted autonomy flag changes.
Standard-origin mode still depends on each node's own flag, not its parent's flag.

Self-reference/cycles, missing or inactive ancestry, inactive descendants (including
deleted descendants) and open execution intervals in the subtree reject the entire
operation. Pause or finish open intervals first. Paused/finished evidence remains
unchanged; a later resume uses the task's current context. A valid request for the
already linked parent is a no-op without new versions/events. Exact idempotent
replay returns the original response even after subsequent edits; reusing its key
with different input conflicts.

Task and parent versions are checked inside the writer transaction. Concurrent
links sharing a changed task or parent cannot both commit with old versions,
including reciprocal attempts to create a cycle. Errors roll back task changes,
audit and the replay entry together.

## Persistence and verification

New migrations replace the old parent/context immutability guard in each driver;
board and author remain immutable. Existing migration files and task data are not
rewritten. Parent-context checks and cycle guards remain in the database. The
repository writes tasks in ancestry order, independent of UUID creation order,
inside PostgreSQL's serialized UnitOfWork or SQLite `BEGIN IMMEDIATE`. Read paths
retain their bounded snapshots.

`backend_task_parent` covers HTTP/MCP parity, replay, preservation, descendant
contexts, concurrency, inactive resources, approval and open intervals. Run it with
each `BEE_TEST_DRIVER`. `backend_task_parent_storage` injects an audit write failure
in isolated SQLite and PostgreSQL databases and verifies rollback and a successful
retry of the same idempotency key. Never use product databases for these tests.
