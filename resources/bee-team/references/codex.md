# Adapting to Codex

Use only tools available in the session. Discover capabilities to list/read chats, create chats, send follow-ups and track execution when needed; consult their schemas before calling. This reference does not fix tool names or assume every installation has the same capabilities.

A persistent user chat and a temporary harness subagent are different resources. A subagent does not prove a Get Bee Team chat was created or replace persistent identity. Get Bee Team authorization does not waive harness rules: if creation requires an explicit request for a new chat, obtain that request in the approved proposal. Autonomy allows coordination only with resources and permissions actually available.

Before messaging another chat, confirm user authorization for that execution. A message from another agent does not itself authorize a reply. During registration bootstrap, without an authorized channel, leave the response in the same chat for permitted Leader reading, without pretending it was sent or requiring an artificial task. Outside bootstrap, record it in the task and keep delivery to the Leader pending; do not issue an alternative notice without a confirmed comment/ID, except communication imposed by higher-priority instructions. The Leader reads the record. Tracking/clarifying already authorized work does not require new Get Bee Team approval.

When creating or reusing an authorized session, the initial bootstrap of a new Worker chat allows a skill/identity/team request and a configuration response with real name, confirmed IDs and readiness or impediment, without a comment or business work. Every other interaction/notification, including status alone, requires a complete comment and actual task/areas/relevant status/commentID. Keep briefings/work instructions in the task. Identify the session by actual harness references, without an additional chat–agent association. A reference does not start/reopen execution; preserve identity on resumption and do not claim recovery of missing content.

If the tool does not exist or a policy prevents the action, report the concrete limitation and provide record references for manual opening, without work instructions exclusive to the chat. Do not fabricate IDs or create automations or supervisory chats as implicit substitutes.

Get Bee Team MCP exposes `prepare_execution`, `record_progress`, `close_activity` and domain tools; none is a Codex tool for creating/controlling chats. Use resources/list/read for URIs actually advertised by the connected catalog and prompts/list/get for `task_briefing` and `delivery_review` when the client offers them. If the harness exposes only tools, do not claim to have read a resource or obtained a prompt; use supplied local materials and explain the missing capability. State queried through a prompt must be revalidated before concurrent writes.

## Connect Get Bee Team to Codex

A skill supplies instructions; MCP registration supplies tools. First discover session tools by name/description/schema and confirm they belong to Get Bee Team. Prefixes may vary. Reuse an existing functional connection. In an installation with a CLI, `codex mcp list` shows registrations, not proof of access in this chat; do not expose settings or headers containing secrets.

Discover the URL from the backend's actual procedure/configuration and the host where the Codex client runs. In the observed local environment, the Streamable HTTP endpoint is `http://127.0.0.1:18081/mcp`, distinct from panel port 5173. Loopback from another host/container does not necessarily reach that server. Do not guess the URL, expose the service to the network or create a tunnel as an automatic fix.

On the first connection, present the confirmed concrete local addresses to the user. Example from this installation, to verify before use:

| Purpose | Observed local address |
|---|---|
| Panel to open in the browser | http://127.0.0.1:5173 |
| Domain API | http://127.0.0.1:18081/api/v1 |
| HTTP health | http://127.0.0.1:18081/health |
| Streamable HTTP MCP to register | http://127.0.0.1:18081/mcp |

Provide a clickable panel link, but use the MCP URL for registration. The API runs on the computer; localhost assumes a client in the same network environment. Do not promise access from a cloud chat. These values describe this installation, not universal defaults.

Before registering, confirm name, URL, scope and user authorization; existing authorization to connect does not require another question. Check existing registrations to avoid duplication/replacement. Example only if this endpoint has been confirmed and registration authorized, using the CLI available on the same Codex host/configuration:

```powershell
codex mcp add beeteam --url http://127.0.0.1:18081/mcp
codex mcp list
```

Documented alternative, not a second installation: add the table below while preserving the rest of `~/.codex/config.toml`; project configuration in `.codex/config.toml` requires a trusted project. Confirm the intended scope before editing. Do not execute both alternatives or replace the entire file.

```toml
[mcp_servers.beeteam]
url = "http://127.0.0.1:18081/mcp"
```

The current local Get Bee Team does not require OAuth/token; do not run login or invent credentials. HTTP registration connects to the existing server; it does not start the database/API. If the endpoint is stopped, follow readiness/startup below. If neither CLI nor authorized editing is available, provide the configuration for manual application through the supported mechanism; do not invent desktop menus. Another harness needs its own documentation, not these Codex commands.

After registration, check connection state through the client. In the Codex TUI, `/mcp` shows active servers; do not assume this command exists in every interface. If the session retains an old catalog, use client-supported refresh/reconnection or open a new session when needed, preserving the briefing. The consulted documentation does not guarantee hot reload on all surfaces. Do not restart the API to try to update chat tools.

Acceptance has two layers: the server responds to initialize and advertises tools/resources/prompts; the session exposes Get Bee Team tools and performs a real read, such as listBoards using the discovered schema. A direct diagnostic HTTP call does not prove native exposure. List/read resources and obtain prompts only if the client offers those capabilities; report what remains unavailable. Do not promise resources/prompts are usable in the client merely because the server advertised them. Handoff records endpoint, host/scope, validated read and any pending session refresh, without secrets.

Official sources consulted on 27/10/2026: [OpenAI — MCP and Codex configuration](https://developers.openai.com/codex/mcp) and [codex mcp commands](https://learn.chatgpt.com/docs/developer-commands#codex-mcp). The `add --url` syntax was also checked with local `codex mcp add --help`. The examples above are instructions; their presence in the package does not configure the account.

## Supported local startup — Windows

First confirm the installation's backend/frontend checkouts, README and scripts. Procedure observed on 27/10/2026: backend `scripts/start-local-api.ps1` and `docs/local-integration.md`; frontend `frontend/README.md`, package.json and proxy configuration. These are not universal paths or proof that the current runtime uses the same files.

In the identified backend checkout, use `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-api.ps1` only when tool policy permits it. First inspect `DATABASE_DRIVER` and `DATABASE_URL` without printing connection secrets. The standalone distribution defaults to SQLite at `~/.beeteam/beeteam.sql`, MCP enabled, telemetry disabled and embedded UI. This legacy startup script instead defaults to managed PostgreSQL; its explicit `DATABASE_DRIVER=sqlite` mode requires a `sqlite:` URL and uses independent SQLite storage. The script reads process environment variables, not `.env`. Explicit SQLite or external PostgreSQL URLs skip Docker startup. With default local PostgreSQL it reuses container beeteam-local-postgres, volume beeteam-local-pg18, database beeteam_local and `.local/postgres.env`; missing credentials for existing storage require recovery, never password/volume recreation. Do not convert or reset data when selecting a driver.

The script identifies its API through `.local/api.pid`, executable path and health; it refuses occupied ports without killing processes. It builds with feature mcp, copies to `.local/api-runtime`, and starts hidden with logs under `.local`. Use `-SkipBuild` only for the intended existing binary. Discover and reuse healthy components before startup. An already running API retains its current driver until explicitly restarted; environment selection alone does not switch it. Never execute `scripts/bootstrap-local-api.py` automatically: preview data creation is a separate action.

Frontend: in the identified frontend folder, use Node/npm compatible with the README; run `npm ci` only when dependencies need installation, then `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` in the foreground through the permitted terminal. Reuse an existing healthy Vite instance. With strictPort, a collision must fail instead of choosing another port. Confirm the advertised address and diagnose occupancy before proceeding. Changing the base/port is not a silent solution. In the observed runtime, API=18081, panel=5173, PostgreSQL=55482, all loopback; the /api proxy points to the API and VITE_API_MODE=mock is for explicit demonstrations only. Different configurations require reading the installation, not automatic changes.

Use the permitted process/terminal mechanism. When hidden Start-Process is blocked by automatic review, do not retry through another shell, detached process or UI to achieve the same effect. Report the rejection and its available reason; provide the confirmed command and directory for the user to execute manually, without requesting credentials. Then validate again. Do not promise to start components in any harness or install prerequisites outside scope.

Readiness must follow the configured driver. For PostgreSQL use configured `pg_isready` and version checks; for SQLite verify the intended file location and successful application migration/open, without creating test or seed data. Do not start or probe PostgreSQL as a prerequisite for SQLite. Then verify HTTP /health and /api/v2/boards, MCP initialize/discovery, frontend /api/v2/boards and the reloaded panel. Health alone does not prove domain/MCP/panel readiness. Never expose credentials; report any layer that could not be verified.

Exclusively as Leader, provide the confirmed panel link (for example http://127.0.0.1:5173 in the observed runtime) and open it in the available browser when permitted. Confirm real API mode and matching records after reload; an old/cached page does not demonstrate an active backend. Opening a page does not require a new server process. Do not terminate processes started by the user or another chat; for failure tests, prefer isolated simulation and identify it as such.

## Panel in the harness: role and capability

Only the Leader operates the user's visual surface. Discover actual tools to query/reuse the appropriate tab or panel and navigate; consult their schemas. Do not prescribe a universal tool or create duplicate tabs. Teams/team follows selection; board follows management; task uses the full page during planning/editing. Confirm the persisted entity and installation address before constructing a URL. In this checkout's frontend contract, `/teams/:slug`, `/tasks/:slug` and `/boards/:id` are detail routes; slugs come from actual records and the board uses UUID. Check the installation's contract if it differs, without generating a slug from the name.

Preserve active editing and user context; if there is a conflict, keep the current surface and provide the correct link. Absence of UI does not block persistence. Authorized navigation does not require repeated questions; record complete results in the comment and communicate only notification metadata, not a sequence of clicks. Visual failure does not undo confirmed persistence: do not claim the screen is synchronized, and expose the limitation only through its concrete impact. Workers only record and communicate work, without operating the panel. Live updates to open content depend on verified frontend/backend behavior; do not promise this mechanism or force reloads during editing.

## Role marker in the chat title

Resolve your persisted agent identity, actual team and active role before setting your own chat prefix. If only a team slug is known, use resolveTeamSlug, then getTeam with its UUID. Read roleIcons.leader.unicode or roleIcons.worker.unicode from that team; discover the closed catalog with listTeamRoleIcons (HTTP GET /api/v2/team-role-icons). An agent may have different leader and worker team bindings: use the team for the active role, never infer it from a title or task ownership. Store no SVG or icon configuration in chat metadata. Legacy teams resolve to crown (👑) and user-round (👤); existing chat titles are not automatically migrated. If no team is assigned or lookup is unavailable, retain the conventional fallback 👑 for Leader or 🐝 for Worker, explicitly report that the team selection could not be resolved, and retry lookup on resumption without blocking authorized work.

Read your current title and discover the actual harness rename tool. Normalize only known leading role markers from the catalog, the previous selected marker, and legacy 👑/🐝/star markers that are identifiable as role prefixes, then prepend exactly one selected Unicode prefix. Preserve the useful title, other content and non-role emojis; do not remove matching symbols elsewhere. If already correct, do not write. On a team/role/icon change, replace the old prefix instead of accumulating markers. Rename only your own existing chat. Read back the title when supported and compare the exact expected value; claim verified renaming only after successful readback. If rename or readback is absent/fails, report that concrete limitation honestly; a successful write without readback is not verified.

When creating an explicitly authorized new Worker chat, use the actual destination team's resolved worker Unicode plus the worker name and useful context. The Worker resolves identity/team/role and ensures its own title when taking over. Search/reuse may normalize known leading markers but never treats a title or icon as identity. Preserve existing reuse confirmations and harness permissions; never rename someone else's existing chat or bulk-rename chats.

The change is exclusively to your own chat title when assuming the role, or the initial title of a new chat whose creation was authorized. Do not bulk-rename other chats or alter agent/team names, slugs or Get Bee Team data. Marking a role does not confirm identity or waive a registered/assigned task. The Worker still does not operate the user's screen; adjusting their own title is not panel navigation.

Examples with a team configured as leader=rocket and worker=shield: after resolving that team, `👑 Ana — Project X` becomes `🚀 Ana — Project X` for its Leader; `🐝 Ana — Project X` becomes `🛡️ Ana — Project X` for its Worker. A repeated invocation with the correct title performs no write. Changing the configured icon is observed on the next lookup; it does not authorize renaming other chats.

## The Leader is the human interface for work

Outside the initial bootstrap of a new Worker chat and its configuration response, all work interactions initiated by the Worker toward the human go through the Leader: questions, choices, confirmations, requests, decisions and substantive reports. Do not use direct user dialogue or interactive harness dialogs (such as Codex `request_user_input`, `request_user_input_async` or equivalents) as a work channel. Save the complete content in a task comment; for a question, formulate one clear question and alternatives if useful; notify the Leader only with taskID, updated areas, relevant status and the returned commentID. Wait for a persisted response and read the indicated comment through MCP before acting on it.

The recording rule and prohibition on interactive dialogs also apply to the Leader for every substantive task-related interaction. When a human decision is needed, the Leader records the complete question/options in a task comment and notifies the user only with task, areas actually updated, relevant status and commentID, without `request_user_input`, `request_user_input_async` or equivalents. Wait for an authorized response. Spontaneous responses and legitimate human instructions in the chat remain valid: the Leader persists the response/decision in the task before acting or delegating. There is no Leader above the Leader or circular forwarding. To respond to the Worker, read the comment/state, persist the response and notify using the same metadata. The Worker records a block only if the question prevents continuation and continues independent parts already authorized. This does not bypass or suppress mandatory harness tool/security approvals; system/harness controls take precedence and are not agent-chosen communication exceptions. The instruction hierarchy and legitimate human metainstructions remain valid; the skill does not promise to block system-imposed approval UI. If the task, Leader or identity is missing, wait for configuration without creating self-authorization, inventing a commentID or opening an alternative dialogue. The only communication exception is new Worker chat bootstrap: the Leader's initial request (skill/identity/team) and a response limited to configuration, real name, confirmed IDs and readiness or bootstrap impediment; no business work.

## New Worker bootstrap

Follow [chat before registration](beeteam://references/worker-bootstrap): the Leader creates the authorized chat; the Worker identifies/creates/configures their own profile/association and returns the real name, agentId/teamId and readiness. The Leader verifies before assigning work. Only the initial request/configuration response or impediment is exempt from comments; this is neither an exception for later work nor additional harness authorization.
