# Bee Team HQ Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Bee Team installation starts with a protected "Bee Team HQ" system team whose leader ("Bee Team Guide") is ready in the chat panel. The team also has a "Getting started" board with onboarding tasks.

**Architecture:** An internal backend module (`src/services/backend/onboarding.rs`) reuses the existing `ra::run` and `kanban::run` command handlers on one write UnitOfWork, then tags the created rows with `systemKey` and `onboardingSeedVersion`. `src/main.rs` calls it once at startup. Shared services enforce protection, so HTTP and MCP stay in parity. Contracts expose a read-only `system` flag and a `system` filter on team lists. The frontend chat panel resolves HQ when no team is selected.

**Tech Stack:** Rust (Axum, SQLx, SQLite/PostgreSQL), OpenAPI contracts, React + TanStack Query + Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-onboarding-hq-design.md`

## Global Constraints

- Layering: routes → dto → service → repository. No file may exceed 1000 lines.
- Migrations: SQLite and PostgreSQL migrations are independent. Never reset product databases.
- Error code for protected operations: `system_resource_protected` (HTTP 409; the default in `src/routes/backend.rs` already maps unknown codes to 409).
- `systemKey` value: `"onboarding"`. It is never exposed in responses and never accepted in requests.
- Names: agent "Bee Team Guide", team "Bee Team HQ", board "Getting started".
- Seed content lives in `resources/onboarding/*.md` and is written in English.
- After each change run `cargo build`, then the targeted tests with `BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false`. Run the PostgreSQL tests too when `BEE_TEST_DATABASE_URL` is available.
- Commits carry the trailer `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- Update CHANGELOG.md under Unreleased.

---

### Task 1: systemKey uniqueness migrations

**Files:**
- Create: `migrations/sqlite/0011_system_resources.sql`
- Create: `migrations/202611100001_system_resources.sql`

- [ ] **Step 1: Create the SQLite migration**

```sql
CREATE UNIQUE INDEX agents_system_key ON agents(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX teams_system_key ON teams(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX boards_system_key ON boards(json_extract(data,'$.systemKey')) WHERE json_extract(data,'$.systemKey') IS NOT NULL AND deleted_at IS NULL;
```

- [ ] **Step 2: Create the PostgreSQL migration**

```sql
CREATE UNIQUE INDEX agents_system_key ON agents((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
CREATE UNIQUE INDEX teams_system_key ON teams((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
CREATE UNIQUE INDEX boards_system_key ON boards((data->>'systemKey')) WHERE data ? 'systemKey' AND deleted_at IS NULL;
```

- [ ] **Step 3:** Run `cargo build`. Migrations are embedded at compile time, so this must succeed.
- [ ] **Step 4:** Commit with message `feat: unique system resource keys`.

### Task 2: Onboarding seed service

**Files:**
- Create: `resources/onboarding/01-tour.md` … `06-connect-harness.md`
- Create: `src/services/backend/onboarding.rs`
- Modify: `src/services/backend/mod.rs` (add `mod onboarding;`), `src/services/backend/service.rs` (add `ensure_onboarding`), `src/main.rs` (call it after transfer recovery)
- Modify: `tests/support/mod.rs` (add `seeded_app()`)
- Test: `tests/backend_onboarding.rs`

**Interfaces:**
- Produces: `BackendService::ensure_onboarding(&self) -> Result<OnboardingIds>`, where `pub struct OnboardingIds { pub agent_id: Uuid, pub team_id: Uuid, pub board_id: Uuid }`.
- Produces: `pub const SYSTEM_KEY: &str = "onboarding";` in `services::backend::onboarding`.
- Produces: `pub fn is_system(record: &Record) -> bool` (true when `data.systemKey` is a string).

- [ ] **Step 1: Write the failing tests** (`tests/backend_onboarding.rs`)

```rust
mod support;
use serde_json::Value;
use support::*;

#[tokio::test]
async fn empty_install_gets_one_ready_hq_and_reseeding_is_idempotent() {
    let (app, state) = seeded_app().await;
    let again = state.backend().ensure_onboarding().await.unwrap();
    let teams = get(&app, "/api/v2/teams?includeArchived=true").await;
    assert_eq!(teams["total"], 1);
    let team = &teams["items"][0];
    assert_eq!(team["name"], "Bee Team HQ");
    assert_eq!(team["system"], true);
    assert_eq!(id(team), again.team_id.to_string());
    let leader = get(&app, &format!("/api/v2/agents/{}", team["leaderId"].as_str().unwrap())).await;
    assert_eq!(leader["name"], "Bee Team Guide");
    assert_eq!(leader["system"], true);
    let boards = get(&app, &format!("/api/v2/boards?teamId={}", id(team))).await;
    assert_eq!(boards["total"], 1);
    assert_eq!(boards["items"][0]["system"], true);
    let tasks = get(&app, &format!("/api/v2/tasks?boardId={}&limit=50", id(&boards["items"][0]))).await;
    assert_eq!(tasks["total"], 6);
    assert!(tasks["items"].as_array().unwrap().iter().all(|t| t.get("systemKey").is_none()));
}

#[tokio::test]
async fn seed_never_recreates_user_edited_onboarding_tasks() {
    let (app, state) = seeded_app().await;
    let board = &get(&app, "/api/v2/boards").await["items"][0];
    let tasks = get(&app, &format!("/api/v2/tasks?boardId={}", id(board))).await;
    let task = &tasks["items"][0];
    ok(&app, "PATCH", &format!("/api/v2/tasks/{}", id(task)), serde_json::json!({"title":"Mine"}), ver(task)).await;
    state.backend().ensure_onboarding().await.unwrap();
    assert_eq!(get(&app, &format!("/api/v2/tasks?boardId={}", id(board))).await["total"], 6);
    let _: Value = get(&app, &format!("/api/v2/tasks/{}", id(task))).await;
}
```

Add to `tests/support/mod.rs` a `seeded_app() -> (Router, AppState)`. It builds the same state as `app()` (SQLite when `BEE_TEST_DRIVER=sqlite`, otherwise PostgreSQL), calls `state.backend().ensure_onboarding().await.unwrap()`, and returns `(create_router(state.clone(), &config), state)`. To share the setup, refactor `app()` into `app_state() -> (AppState, AppConfig)`.

- [ ] **Step 2:** Run `BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test --test backend_onboarding`. Expected: compile FAIL, because `ensure_onboarding` is missing.

- [ ] **Step 3: Implement `onboarding.rs`**

Behaviour:
1. `let mut unit = repository.begin().await?`.
2. If any team, including archived ones, has `data.systemKey == "onboarding"`, read its IDs, roll back and return them.
3. Build internal `Command`s with actor `human` and no ID, and the manual coordination context `{"mode":"manual"}`. Run them on `unit` in this order:
   - `ra::run` with `createAgent` and body `{name, roleDescription, workInstructions}`;
   - `ra::run` with `createTeam` and body `{name, purpose, context, leaderId, workerIds: [], coordinationContext}`;
   - `kanban::run` with `createBoard` and body `{teamId, name, description, autonomyMode:"manual"}`;
   - `kanban::run` with `createTask` for each `resources/onboarding` file, with `params.boardId` and body `{title, description, specification, authorAgentId: guide, executorAgentId: guide, coordinationContext}`.
   Titles come from each file's first `# ` heading. The remaining text is `specification`, and `description` is a one-line summary constant.
4. Set `data.systemKey = "onboarding"` on the agent, team and board.
5. For every row in `unit.records.rows` whose `created_at` is in this unit, set `data.onboardingSeedVersion = record.version`. Track the inserted IDs via the commands' `created_id` plus statuses and events filtered by `boardId`/`taskId`.
6. Run `unit.commit().await?`. If commit fails with a unique-constraint conflict, call `ensure_onboarding` once more; the re-read then returns the existing IDs.

Load content with `include_str!("../../../resources/onboarding/01-tour.md")` and so on.

`main.rs`: after the transfer block, run `state.backend().ensure_onboarding().await.map_err(|e| anyhow::anyhow!("onboarding seed failed: {e}"))?;`.

- [ ] **Step 4:** Run the onboarding tests. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat: seed Bee Team HQ onboarding workspace`.

### Task 3: system flag and team filter in contracts and reads

**Files:**
- Modify: `docs/ra-openapi.yaml` (Agent, Team: `system: {type: boolean, readOnly: true}`; listTeams query param `system`; error enum `system_resource_protected`), `docs/kanban-openapi.yaml` (Board `system`; error enum)
- Copy: `docs/*-openapi.yaml` → `frontend/contracts/`
- Modify: `src/services/backend/queries.rs` (`resource()` and `list()` set `system`)
- Modify: `src/repositories/sqlite/query.rs` and `src/repositories/query.rs` (filter `system`)
- Regenerate: `frontend/src/api/generated/**` (`npm run generate:types`), `docs/mcp-catalog.json` and `docs/mcp-catalog.md` (`cargo run --locked --features mcp --example mcp_catalog`; copy them to `frontend/contracts/` if they are mirrored there)
- Test: extend `tests/backend_onboarding.rs`

- [ ] **Step 1: Write the failing test**

```rust
#[tokio::test]
async fn system_filter_finds_hq_among_user_teams() {
    let (app, _) = seeded_app().await;
    let agent = ok(&app,"POST","/api/v2/agents",serde_json::json!({"name":"A lead"}),None).await;
    ok(&app,"POST","/api/v2/teams",serde_json::json!({"name":"Alpha","leaderId":id(&agent),"coordinationContext":manual()}),None).await;
    let system = get(&app,"/api/v2/teams?system=true").await;
    assert_eq!(system["total"],1);
    assert_eq!(system["items"][0]["name"],"Bee Team HQ");
    let user = get(&app,"/api/v2/teams?system=false").await;
    assert_eq!(user["items"][0]["system"],false);
}
```

- [ ] **Step 2:** Run it. Expected: FAIL (`system` is unknown).
- [ ] **Step 3:** Implement the code:
  - in `queries.rs`, add `fn mark_system(table:&str, value:&mut Value)`, which sets `value["system"] = json!(value["systemKey"].is_string())` for agents, teams and boards, and call it in `resource()` and in `list()` per item;
  - in both query builders, inside the filter `match`, add `"system" => q.push("(value->>'systemKey' IS NOT NULL)=").push_bind(expected.as_bool().unwrap_or(false))`. On PostgreSQL, bind a boolean the same way the `archived` arm does.
- [ ] **Step 4:** Run the onboarding tests and `cargo test --test backend_api`. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat: expose system resources in contracts`.

### Task 4: Protection rules

**Files:**
- Modify: `src/services/backend/ra.rs` (archiveAgent, archiveTeam, changeTeamComposition), `src/services/backend/kanban.rs` (updateBoard)
- Test: `tests/backend_onboarding.rs` (HTTP), plus MCP via a `tool()` helper like the one in `tests/backend_team_role_icons.rs` (gated by `#[cfg(feature="mcp")]`)

- [ ] **Step 1: Write the failing tests.** Each request below must return status 409 with `code == "system_resource_protected"`:
  - `PUT /api/v2/teams/{hq}` with body `{"archived":true}` and If-Match;
  - archive of the guide agent (same form as `archiveAgent` in `docs/ra-openapi.yaml`);
  - `PATCH /api/v2/boards/{board}` with `{"archived":true}` or with `{"teamId":other}`;
  - `changeTeamComposition` with a new `leaderId` for HQ.

  After each rejection, GET returns the same version. Also assert that `PATCH` renaming HQ succeeds, and that MCP `archiveTeam` returns `isError:true` with the same code.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement `onboarding::protect(record) -> Result<()>`, returning `Failure::new("system_resource_protected","System onboarding resources cannot be archived, reassigned or transferred")`. Call it:
  - in ra.rs `updateAgent|archiveAgent`, when `body["archived"]==true`;
  - in `updateTeam|archiveTeam`, when `body["archived"]==true`;
  - in `changeTeamComposition`, when `change["leaderId"] != team.data["leaderId"]`;
  - in kanban `updateBoard`, when `b["archived"]==true` or `b["teamId"]` differs.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat: protect onboarding system resources`.

### Task 5: Restore into a pristine seeded database

**Files:**
- Create: `src/repositories/transfer/seed.rs`, holding the shared SQL and an explanatory comment
- Modify: `src/repositories/transfer/sqlite.rs` and `postgres.rs` (`destination`), `sqlite_restore.rs` and `postgres_restore.rs` (pre-import cleanup)
- Test: extend the existing transfer test file (`tests/*transfer*` or the module tests in `src/repositories/transfer`)

- [ ] **Step 1: Write the failing test.** On a seeded SQLite instance, `destination().empty` is true. After `PATCH` of any onboarding task it is false. A restore of an exported empty-or-populated archive into the pristine seeded DB succeeds and leaves no extra HQ when the archive already contains one.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the seed check. For each group table, count rows that are NOT pristine seed rows. A pristine seed row is one where `data` has `onboardingSeedVersion` equal to `version` and `archived_at`/`deleted_at` are NULL. Tables without `data`/`version` (`file_contents`, `request_replays`, `authors`, `posts`) count all rows.
  - Empty means every non-seed count is 0.
  - In restore, if empty, run `DELETE FROM {table} WHERE <pristine>` inside the restore transaction before the existing `count == 0` check. Delete child tables first: events, tasks, statuses, boards, memberships, teams, agents.
- [ ] **Step 4:** Run the transfer tests on both drivers. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat: allow restore over pristine onboarding seed`.

### Task 6: Frontend default HQ chat

**Files:**
- Modify: `frontend/src/state/chat-panel.ts` (add `picking: boolean`; `chooseTeam` sets `picking:true`; `openTeam` sets `picking:false`)
- Modify: `frontend/src/features/chat-side-panel.tsx` (`PanelDefault` queries `api.list("teams","",{system:true,limit:1})` and renders `PanelTeam` for it; `PanelTeamPicker` marks the system team)
- Modify: `frontend/src/features/teams.tsx`, `agents.tsx`, `boards.tsx` (badge and hidden archive action when `system`)
- Modify: i18n catalogs `chat.*`, `common.*` (en/pt): `chat.talkToGuide`, `common.system`
- Test: `frontend/src/features/chat-side-panel.test.tsx`

- [ ] **Step 1: Write the failing test.** With `teamId` null, `picking` false and an `api.list` mock that returns `[{id:"hq",name:"Bee Team HQ",system:true}]`, opening the panel renders the HQ name and the leader chat. After clicking "Choose team", it shows the picker.
- [ ] **Step 2:** Run `cd frontend && npx vitest run src/features/chat-side-panel.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep the `picking` state persisted. The default panel falls back to `PanelTeamPicker` if the list is empty, which covers old backends.
- [ ] **Step 4:** Run the panel tests, then `npm run typecheck`, `npm test`, `npm run lint` and `npm run audit:i18n`. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat: open Bee Team HQ guide by default in chat panel`.

### Task 7: Docs, changelog and full verification

**Files:** `CHANGELOG.md` (Unreleased), `README.md` (first-run section), `AGENTS.md` (one bullet on system onboarding resources)

- [ ] **Step 1:** Write the documentation.
- [ ] **Step 2:** Run `cargo build`, `BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test --features mcp` and the frontend checks.
- [ ] **Step 3:** Manual check: start the app on a new empty SQLite file and open `/app/`. The chat panel shows the Bee Team Guide.
- [ ] **Step 4:** Commit with message `docs: document Bee Team HQ onboarding`.
