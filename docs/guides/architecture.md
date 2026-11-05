# Follow a task update

The React panel and MCP client share a local Rust backend. The automation harness owns model calls, chat context, tools and command execution. Bee Team stores the team’s shared work record. A task carries its board, author, executor, project scope, specification, plans and current progress. Its comment history lets a different chat retrieve an exact decision.

## From a worker to the board

1. The worker checks the assigned task and its version. To report a milestone, it submits an execution summary through MCP. HTTP exposes the equivalent operation. Routes extract the actor, idempotency key, version and payload. DTOs validate the contract.
2. The service checks domain rules and orchestrates a unit of work through repository contracts. Status changes are recorded with the historical summary, the worker’s current synthesis and the required usage and commit reports. An execution boundary can be recorded in that transaction.
3. The configured SQLx adapter commits the records or rolls back together. SQLite serializes writers; PostgreSQL uses the repository transaction policy. Reads filter, order and page in a bounded database snapshot.
4. The response returns through the service and DTO to the client. The panel consumes change notifications and refreshes the affected records. The worker records a full task comment and notifies the lead using the persisted task and comment IDs.

Agents and teams have stable UUIDs and immutable URL slugs. Resolve slugs with typed lookups before using UUIDs in writes. A board has a managing team. A task’s executor can belong to another team, and a subtask can be on another board. Audit fields are declared metadata.

Browse the [routes](../../src/routes), [DTOs](../../src/dto), [services](../../src/services) and [repositories](../../src/repositories). Read the [Kanban](../kanban-openapi.yaml) and [agents and teams](../ra-openapi.yaml) contracts for operation-specific payloads.
