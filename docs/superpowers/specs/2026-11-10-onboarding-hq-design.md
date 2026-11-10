# Ready-to-use first session: the Bee Team HQ onboarding team

Status: design approved, not implemented.

## Problem

On a fresh database there are no teams or agents. The chat side panel (`frontend/src/features/chat-side-panel.tsx`) needs a `teamId` and that team's `leaderId`. With neither, it shows only `PanelTeamPicker` ("choose a team" / "no teams"). The user has no one to talk to who could help create teams, agents and boards, which is exactly what a first session should provide.

## Decisions

- Every installation has an **onboarding team** whose tasks teach the user to use and configure Bee Team.
- The onboarding team is **fixed and cannot be removed**.
- After onboarding, the team **remains as a system team** ("Bee Team HQ"). Its leader stays the default starting point for creating and managing teams, agents and boards. This is the default because the user skipped this question. Hiding or deleting the team after onboarding is out of scope.

## Approaches considered

1. **Backend system seed (chosen).** At startup an idempotent service ensures that the HQ team, its leader agent, a "Getting started" board and its onboarding tasks exist. System resources are protected in services, so HTTP and MCP behave the same.
2. **Frontend creation on empty state.** The UI calls existing APIs when it sees zero teams. Rejected: concurrent tabs can create duplicate teams, MCP/skills users never get the team, and protection would be cosmetic only.
3. **Global assistant outside teams.** Rejected: it contradicts the onboarding-team decision and requires changing the chat contract, which is bound to a team and its leader.

## Design

### Identity and persistence

- Add an optional, immutable `systemKey` string to agent, team and board records. The only value defined now is `"onboarding"`.
- Add independent migrations for SQLite (`migrations/sqlite/`) and PostgreSQL (`migrations/`). Each creates a unique partial index on the `systemKey` stored in record data, per resource table, where it is non-null. The index enforces at most one onboarding team, leader and board, even under concurrent startups.
- Generate UUIDv7 IDs and slugs normally. `systemKey` is the lookup key, never an identifier, URL alias or credential.
- Public create/update requests cannot set or change `systemKey`. Unknown-field rules continue to reject it.

### Seed service

- New module `src/services/onboarding/` exposing `ensure_onboarding_workspace`. It depends only on `repositories/contracts.rs`.
- `src/main.rs` calls it once after migrations, before the HTTP/MCP listener starts. It runs in one serialized write transaction using the existing UnitOfWork (`BEGIN IMMEDIATE` on SQLite).
- Behaviour:
  - If the onboarding team exists, do nothing. Never recreate, rewrite or reorder user-edited or archived onboarding tasks.
  - Otherwise create, atomically:
    - agent "Bee Team Guide" (`systemKey=onboarding`);
    - team "Bee Team HQ" led by that agent (`systemKey=onboarding`);
    - board "Getting started" managed by that team (`systemKey=onboarding`);
    - the onboarding tasks listed below, assigned to the team leader.
  - A unique-index conflict means another process seeded concurrently: roll back, re-read and succeed.
- It runs on existing installations too. Seeding is additive and never changes other teams, agents or boards.
- Task content lives in versioned Markdown under `resources/bee-team/onboarding/`, written in English like other bundled resources. Specification and execution plans remain plain Markdown and are never rendered or executed by the service.

Onboarding tasks:

1. Tour the panel: Home, Tasks, Agent resources, Teams and the chat panel.
2. Configure the guide's execution runtime (existing `configureAgentExecution` flow).
3. Create your first team and its leader.
4. Add worker agents to a team.
5. Create a board and a first task.
6. Connect an external harness through MCP and the Bee Team skills.

Onboarding tasks are ordinary tasks. Users can edit, complete, move or archive them.

### Protection

Enforce protection in the shared business services so HTTP and MCP stay identical. Routes and MCP adapters only map the error.

| Operation | Rule for `systemKey` resources |
| --- | --- |
| `archiveTeam` | rejected for the HQ team |
| `archiveAgent` | rejected for the guide agent |
| `updateTeam` | renaming/description allowed; changing `leaderId` rejected |
| `changeTeamComposition` | removing the guide from HQ rejected; adding/removing other members allowed |
| `updateBoard` | metadata edits allowed; archiving or transferring management away from HQ rejected |

- Rejections return HTTP `409` with code `system_resource_protected` and the matching MCP structured domain error. Nothing is mutated, and an idempotent replay returns the same stored error.
- The guide agent's profile and execution configuration remain editable.

### Contracts

- `docs/ra-openapi.yaml` and `docs/kanban-openapi.yaml`:
  - add a read-only `system: boolean` to `Agent`, `Team` and `Board` (true when `systemKey` is present). `systemKey` itself is not exposed;
  - add the `system_resource_protected` 409 error to the operations above.
- Regenerate frontend types and `docs/mcp-catalog.json` (`cargo run --locked --features mcp --example mcp_catalog`).

### Frontend

- `chat-side-panel.tsx`: when no team is selected, resolve the system team and open its leader chat by default. "Choose team" still opens the picker, and an explicit user selection persists as today.
- Home and the empty team list no longer present a dead end. They feature "Bee Team HQ" with a "Talk to the guide" action that opens the chat panel.
- System agents, teams and boards show a localized "System" badge (en/pt catalogs). Archive actions, leader replacement and removing the guide from HQ are hidden for them; the server remains the authority.
- If the guide has no execution configuration, the panel shows the existing configuration call to action.

### Errors and edge cases

- Seed failure aborts startup with an actionable log message and leaves no partial records, because everything runs in one transaction.
- Portable transfer preserves `systemKey` as raw domain data. Because every started instance is seeded, restore's empty-destination check treats a database as empty when it holds only the onboarding seed with no user-created records and no change history beyond the seed. Inside the restore transaction, that seed is removed before import. Any other record still blocks restore, and no force/reset option is added. If the archive has no HQ, the next startup seeds one; if it has one, the seed finds it and does nothing.
- An archived or deleted onboarding record from a future policy change is not resurrected. The seed checks existence by `systemKey`, including archived rows.

## Testing

Backend (SQLite and PostgreSQL where the test touches persistence):
- An empty database yields exactly one guide, HQ team, board and the six onboarding tasks.
- Running the seed twice, or concurrently, creates no duplicates.
- Existing installations with teams gain HQ without changes to other records.
- Each protected operation returns 409 `system_resource_protected` over HTTP and MCP without mutation. Allowed edits still succeed.
- `system` appears in agent, team and board responses. `systemKey` cannot be set through create/update.
- Restore succeeds into a database holding only the pristine seed, and is still rejected when any user record exists.

Frontend:
- The panel opens the HQ leader chat when no team is selected.
- The badge renders, and protected actions are hidden for system resources.
- i18n audit passes for the new strings.

Manual: start against a new empty SQLite file, open `/app/`, and confirm that the chat panel opens the guide immediately.

## Out of scope

- Hiding or deleting HQ after onboarding.
- Tracking onboarding progress beyond ordinary task state.
- Changing the managed-agent runtime or authentication model.
