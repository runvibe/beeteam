![Bee Team hexagonal logo](docs/assets/bee-team.svg)

# Bee Team

**Have your own team of agentic bees.**

The managed-agent API is described in [the managed agents contract](docs/proposals/managed-agents-contract.md). It lets clients address agents without supplying provider session IDs. Validate schemas, HTTP/MCP parity and generated TypeScript with `node docs/proposals/validate-managed-agents.mjs` after installing frontend dependencies.

Bee Team gives agents working in separate chats a shared board. A lead can ask one worker to write release notes while another checks the build. Each worker keeps its own chat context and records the decisions, evidence and blockers its teammates need.

Bee Team integrates with external assistants through **Skills and MCP**. Use it with **Codex, Claude Code, GitHub Copilot**, or another harness that supports that workflow: the harness runs the agents and manages model access, while Bee Team provides shared coordination. The optional managed workflow instead runs Bee Team-owned Codex sessions through the locally configured runtime.

During delegated work, workers record questions in Bee Team and notify the leader who assigned the task. The leader asks you for any decision and records your answer for the worker.

## Table of contents

- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Supported platforms](#supported-platforms)
- [Connect your harness](#connect-your-harness)
- [Architecture and storage](#architecture-and-storage)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License and brand](#license-and-brand)

## How it works

Switch light or dark mode in the app sidebar, or change the palette in Settings. The new appearance spreads from the selected control across the window.

Session filter controls use the same responsive sizes as the board header filters.

Open the **Documentation** link on the landing page or the app navigation rail for the interactive guide at `/guide/`. It works before connecting the local API, in English or Portuguese. Choose a harness to see the matching installation and team tutorial steps. The advanced reference includes binary settings and the MCP catalog for this build.

The harness runs the agents and opens their chats. Bee Team stores profiles, team membership, tasks, plans, comments and results locally. The lead assigns work and reviews evidence on the board. Workers communicate by task and comment ID so each can retrieve the exact handoff. [Walk through a two-worker release](docs/guides/first-team.md).

The work summary gives the current status in one or two short sentences (up to 200 characters). Include the main result and any blocker or next step. Record the details in the activity history.

## Quick start

Open the [installation guide](https://getbee.team/guide/installation), choose your harness, and copy its request into your assistant's chat. The same assistant-first flow starts with this prompt:

```text
Follow https://getbee.team/install to install Bee Team on my computer using this assistant. Verify the published release and confirm that the local API is running.
```

1. Your assistant reads the [setup instructions](https://getbee.team/install), identifies your harness and platform, and installs **Setup Bee Team**, **Get a Team Lead** and **Get a Worker** from the same immutable GitHub release tag as the app.
2. **Setup Bee Team** downloads the ready-to-run native binary, verifies its size and SHA-256, installs or updates it while preserving your data, and starts or reuses the local service. This path does not require a source checkout or compiling the application. If a verified package is unavailable, the assistant must report that limitation instead of substituting an unverified download.
3. Open the [Bee Team app](https://getbee.team/app/), allow browser access to the local service if prompted, and check the connection. On a fresh default installation, Bee Team creates a SQLite file in your home directory. The [local connection walkthrough](https://getbee.team/guide/local-connection) explains startup, browser permission and the default port.
4. In a lead chat, ask **Get a Team Lead** to create a team and board in your chosen project. Approve a worker chat and let the lead assign its first task after the worker confirms its profile and team. Follow the task's plan, comments and progress. [Continue with a two-worker example](https://getbee.team/guide/first-team).

## Supported platforms

Native release packages target Windows, Linux and macOS. Availability depends on the operating system and architecture listed in the [published GitHub release](https://github.com/runvibe/beeteam/releases) and verified by the [installation manifest](https://getbee.team/install.json). The setup skill selects the matching artifact; an unsupported platform or missing release is reported explicitly. See the [installation guide](https://getbee.team/guide/installation) for the current user workflow.

## Connect your harness

Register the local HTTP MCP endpoint in the harness that runs your agent. Check discovery and make a read-only call in that session. [Codex, Claude Code and Copilot CLI instructions](docs/guides/mcp.md).

## Architecture and storage

The React panel calls HTTP routes. MCP clients reach the same Rust services. SQLite is the default, and PostgreSQL is available through explicit configuration. [Follow a task update](docs/guides/architecture.md) or [configure storage and transfers](docs/guides/storage.md).

The public guide includes a binary environment reference at `/guide/reference/environment` and a searchable MCP catalog at `/guide/reference/mcp/tools` generated from the same checkout.

## Development

The public site lives in [runvibe/beeteam-site](https://github.com/runvibe/beeteam-site), maintained independently of this application repository. It uses Vike to pre-render the landing page and documentation in English and Portuguese. Application and binary builds do not fetch or bundle that repository. The React/Vite application in `frontend/` mounts at `/app/` and has its own build and PWA update lifecycle. Public articles can be updated independently of the app/API version. See [the product boundaries and verification steps](docs/guides/site-and-app.md).

Run the backend and Vite separately for frontend development, or build the embedded distribution for a single executable. [Development and tests](docs/guides/development.md) · [Runtime modes](docs/guides/runtime.md).

The complete Rust test suite requires a dedicated PostgreSQL 18+ instance through `BEE_TEST_DATABASE_URL`, with permission to create databases. Each shared PostgreSQL test creates its own database. With Docker hosted in WSL, keep the distribution running for the duration of the suite and use its reachable published endpoint. Generated-file test fixtures JSON-escape citation paths so the same tests work with Windows and Unix paths.

### Live voice in managed chats

Choose the voice in general settings. The list comes from the installed Codex runtime. Codex default leaves voice selection to that installation. Your preference is saved on this device and applies when the next call starts. Unavailable saved voices remain visible so you can select a replacement.

Live voice uses the Codex executable installed on the user's machine and its local authentication. Configure the existing managed-session runtime with `BEE_CODEX_EXECUTABLE` and `BEE_SESSION_INSTALLATION_ID`. Browser microphone access requires localhost or HTTPS. Voice availability depends on the installed Codex version and account capabilities.

Start a voice conversation from a writable managed chat. Clear execution requests are sent to that original Codex agent and conversation while the voice conversation continues, using the access mode captured when the call started. Ambiguous requests are clarified first. Existing approval controls apply. Ending the voice call releases the microphone immediately and refreshes the timeline after final transcript persistence. A save failure remains visible in the chat or floating call controls. Already submitted Codex work follows its normal lifecycle. Executed requests and results remain available through managed chat history.

Browsing or typing in another conversation, including opening Home, keeps the original voice call active. The floating avatar and its controls render at 80% of their normal size. The floating avatar is transparent, without a card or visible title, with four icon controls: return beside microphone mute, and end beside playback mute. Hover text and accessible labels identify the original conversation. Hold and drag the avatar freely with a mouse or touch; it stays within the viewport without snapping. Buttons never drag the avatar, Escape or a cancelled gesture restores its previous position, and its position survives returning to the inline chat during the call. Returning to its conversation places the avatar above the composer again. Explicitly starting voice in another chat ends the previous call before starting the selected one; only one call can be active. Navigation alone never starts a call or creates a session. Pending startup and late replies cannot switch the visible chat, and uncertain deliveries are never automatically retried. Errors appear separately as readable, dismissible notices; dismissing an error never retries a delivery.

The composer action starts voice when the draft is empty, sends text when it has content, and ends an active voice call with an X when the draft is empty. The X also remains available while a pending send locks the draft, without discarding its text. The thin hexagonal avatar floats above the composer on a transparent surface. The avatar and every voice control use neutral theme colors: light in dark mode and dark in light mode, including mute, hover and focus states. Extra bottom padding inside the message history keeps the last message clear without shrinking the chat viewport; scrolling messages can pass underneath the avatar. Activating voice scrolls to the bottom once, after the avatar padding is applied; manual scrolling remains available afterward. Its faint outer echo and three central bars respond to the assistant's incoming audio. Reduced-motion preferences keep the outline and bar geometry still. Audio visualization is optional and releases its audio analysis resources when the call ends.

Final user and assistant speech transcripts are saved in the selected managed conversation and displayed in the main timeline like typed messages, without a visible voice label. Their voice origin remains recorded internally. A new voice call creates its conversation before accepting text or delegated work. Transcripts remain available after the call ends and after reloading, including conversations with no Codex execution requests. Spoken requests become execution requests only when explicitly delegated. Availability requires a Codex build supporting the experimental realtime V3 WebRTC protocol and voice access on the signed-in account.


## Troubleshooting

Start with service identity, port and version. If those checks pass, inspect the browser or harness connection handling the request. [Troubleshooting guide](docs/guides/troubleshooting.md).

The disconnected app screen links directly to the [installation guide](https://getbee.team/guide/installation) and [local connection walkthrough](https://getbee.team/guide/local-connection). The walkthrough covers starting the local service, browser permission and the expected port; both links follow the interface language.

When a newer stable Bee Team release is available, the update icon above Home opens the installed and available versions and a request to copy into your assistant.

PWA updates are detected in the background, but their reload notice appears only after the local API connection and version have been verified. Connection and version-blocking screens hide that notice. Update notices show the version currently loaded and the available version; the waiting service worker reports its own compiled application version for a PWA update.

Distribution binaries serve the app at `http://127.0.0.1:59865/app/` by default. Set `BEE_FRONTEND_MODE=disabled` for API/MCP only.

If an assistant's embedded browser cannot grant the hosted app access to the local service, Setup Bee Team can enable the API-served panel with `BEE_FRONTEND_MODE=embedded` and open `http://127.0.0.1:<configured-port>/app/`. It preserves the existing storage and launch configuration, uses the normal service restart procedure, and verifies the local browser view. See the [embedded-browser recovery steps](skills/setup-bee-team/references/bootstrap.md#assistants-embedded-browser).

## License and brand

Bee Team is free to use. Its software and documentation are licensed under the [Apache License 2.0](LICENSE), including commercial use, modification and redistribution under its terms. The Bee Team name, logo and identified brand assets are reserved separately: see [the trademark policy](TRADEMARKS.md), [brand asset permissions](BRAND-ASSETS.md) and [NOTICE](NOTICE). Forks may reuse the code while using their own product identity. Third-party materials retain their own licenses, including the [Lucide artwork notice](docs/team-role-icons-LICENSE). Native release archives include the license, notices and brand terms; the setup helper preserves the allowlisted legal documents alongside the installed executable.

The Bee Team brand owner is Philippe Ferreira Assis Tecnologia da Informação LTDA (trade name: Philtech), CNPJ 59.845.514/0001-90. Third-party rights and contributor attribution remain unchanged.

[Documentation index](docs/README.md)

### Browser and installation icons

The bundled monochrome Bee Team hexagon supplies SVG and multi-size ICO favicons, 16/32/48/96 px PNG favicons, a 180 px Apple touch icon, and 192/512 px regular and maskable manifest icons. Regenerate with `npm run generate:icons` in `frontend/`. The SVG source is `public/icons/bee-logo.svg`; `node scripts/generate-brand-icons.mjs --check` verifies reproducibility. The public site and guide use browser display mode; only the app owns the `/app/` PWA scope.

### Hosted app on Cloudflare Workers

The repository-root `wrangler.jsonc` deploys the hosted PWA to the existing `beeteam` Worker, using routes `getbee.team/app` and `getbee.team/app/*`. Landing and documentation remain in the separate site Worker. Configure Cloudflare Builds with repository root `/`, build `npm run build`, deploy `npx wrangler deploy`, and preview `npx wrangler preview`. Node.js 22 or newer is required.

The root build installs the locked frontend dependencies and builds in an isolated temporary directory and stages only app assets under `.local/cloudflare/app/app/`. It sets the API URL to `http://127.0.0.1:59865/api/v1`; the API and MCP are not hosted by this Worker. Browser permission for local network access may be required. Run `npm run test:worker` and `npm run deploy:check` before deployment. Contributor-only embedded binary build instructions, with their own same-origin API settings, are documented in [Development and tests](docs/guides/development.md).

### Optional browser usage analytics

Choose whether to allow analytics on first use. To change your choice later, open Settings → Cookie preferences. It works without permission and uses in-memory preferences if browser storage is unavailable; persisted choices are per origin, including independent local installs. API-only and MCP service startup do not emit usage analytics.

Analytics is disabled until legal routes are ready (`AnalyticsConsent` with `legalReady`). After opt-in, a hidden frame from the dedicated `https://metrics.getbee.team/analytics/frame.html` origin receives only closed product, UI mode, language and section categories. No task/chat content, entity identifiers, private URLs, queries, hashes or document titles are sent. The cross-origin frame cannot inspect the app DOM/history; strict source/origin/nonce checks protect its message channel. Its Google tag disables automatic page views and advertising signals, uses generic page metadata and requests analytics cookies on the metrics hostname for up to 180 days. Browser third-party restrictions are respected without bypasses. Withdrawal disables the tag and expires its analytics cookies through the frame before teardown; blocking extensions may prevent cookie cleanup acknowledgement, but teardown still proceeds and core UI remains usable.

Managed agent session bindings and the first HTTP/MCP implementation slice are described in [session bindings](docs/agent-session-bindings.md). Legacy chat references remain metadata.


### Managed Conversation delivery

Conversation messages can select team agents with @ mentions; HTTP/MCP callers use explicit `mentionedAgentIds`. Declared session bindings remain separate from provider access and delivery. Local dispatch is opt-in with `BEE_SESSION_INSTALLATION_ID` and an absolute `BEE_CODEX_EXECUTABLE`; credentials stay with Codex. See [managed delivery](docs/managed-session-delivery.md) for activation, outcomes, recovery and isolated acceptance evidence. Claude Code is a future adapter; product token accounting remains a separate phase.

### External and integrated agents

The external mode keeps the existing assistant + MCP + skills workflow. An external chat reference does not let Bee Team control a Codex Desktop session. Integrated mode uses a Bee Team-owned provider session and a leader chat in the panel. Different agents can use both modes in the same team; one agent has one active session binding with replacement history. Check the installed API's capabilities before offering the integrated flow. See [session modes and delivery](docs/managed-session-delivery.md#two-coexisting-session-modes) for the channel rules and current limits.

### Provision integrated workers through MCP

With the local integrated Codex runtime configured, a leader can create/select an agent and call `getAgentRuntime` to observe its active binding. `createIntegratedSession` then accepts `params.agentId`, `body` containing observed `expectedBindingId` (null when unbound), optional `toolProfile`, plus `actor`, `expectedVersion` and `idempotencyKey`. This uses the same service as HTTP and creates a Bee Team-owned session. It never takes over a Codex Desktop chat; generic session declarations remain external-only. Configure `BEE_SESSION_INSTALLATION_ID`, the absolute native `BEE_CODEX_EXECUTABLE` and the local MCP endpoint before using it. See [managed delivery](docs/managed-session-delivery.md) for runtime prerequisites and approval limitations.

### First run: Bee Team HQ

Every database starts with **Bee Team HQ**, a system team led by **Bee Team Guide**, and a **Getting started** board with onboarding tasks. The chat panel opens HQ by default, so you can ask the guide to create your first team, agents and boards before any of your own exist. Open another team's session from **Sessions**, or open its chat from the team's page. HQ resources show a "System" badge and report `system: true`; list endpoints accept a `system` filter. You can rename them or add workers, but you cannot archive them, move the board or replace the leader. A restore into a database whose HQ seed is still untouched replaces the seed instead of failing the empty-destination check.

### Open the integrated leader chat

Run the configured local backend on a loopback address and open the chat panel from the main navigation. Each team chat addresses its current leader. The panel stays open while navigating boards and tasks and splits the screen with the content instead of covering it. On desktop, drag a non-interactive area of the chat, content or Sessions panel header to rearrange the visible panels, including into the middle. A blue preview shows the drop position and Esc cancels. The **Panel layouts** button among the navigation's bottom preferences offers all six panel orders with compact icon-only previews, including keyboard selection and accessible names; hover over a preview to see its panel order. Hidden panels stay hidden. The order is saved on this device, and moving or closing panels preserves their drafts. Drag a divider between panels, or use its arrow keys, to resize the adjacent Sessions, content and chat panels while the navigation stays fixed. Panel widths are saved on this device. The chat can reach 80% of the viewport when there is room; minimum widths keep the other open panels usable. The conversation stays centered at a readable width when the panel is wide. When the remaining content becomes narrow, detail pages switch to a compact details view and header filters remain scrollable. Main content and its header, including the breadcrumb, retain a half-rem horizontal gutter. Settings > Appearance > Chat position also moves the chat to the selected side of the content. On narrow screens the chat opens as an overlay without dragging or resizing, and the desktop layout menu is hidden. Long detail pages retain their independent content scrolling beside the chat panel. Managed execution settings configure web search, additional skill directories and selected existing MCP servers; worker settings also configure command network access. Bee Team owns the workspace.

The chat composer is a plain-text editable field: Markdown remains text, and pasting removes rich formatting. In managed chat, Enter sends and Shift+Enter starts a new line, without an on-screen shortcut hint; the legacy leader chat keeps Ctrl/Cmd+Enter to send. Messages are limited to 65,536 UTF-8 bytes. Fields do not add a focus highlight when clicked, while keyboard navigation retains a visible focus outline.

New team chats open without an agent setup step. The first message starts a Bee Team-owned session using the default chat policy and tool settings; the local Codex runtime and sign-in are still required. Bee Team checkpoints the new session before sending the message, without a synthetic model turn. This does not configure the agent for direct worker requests or automatic task delivery.

The access button below the team chat composer selects the Codex policy for each message: **Read only** runs commands in a read-only sandbox without command network access; **Standard** uses the workspace sandbox and asks for approval; **Full access** removes the sandbox and approvals after explicit confirmation; **Codex configuration** uses the effective local `config.toml` policy. Read-only sandboxing does not restrict web search or MCP tools, and an approved action can run outside the sandbox. The default for chats without a specific choice is set in global settings and saved on this device. Existing sessions configured without command network access retain that restriction in Standard mode. These controls affect integrated team leader chats, not external chats or automatic worker delivery.

While a request runs, the chat shows the Codex reasoning *summary* in a muted "Reasoning" section that collapses automatically when the reply finishes and can be reopened later. Summaries are limited to 16 KiB per message; raw reasoning is never persisted. Bee Team requests `detailed` summaries for its own turns unless `model_reasoning_summary` is set in the Codex configuration, in which case that value is respected. Summaries appear only when the model actually reasons.

Team chat MCP servers and additional skill folders are selected only through the local file `~/.beeteam/chat-tools.toml`:

```toml
enabledMcpServers = ["docs"]
skillRoots = ["/absolute/path/to/skills"]
```

Server names must already exist in the Codex configuration; credentials and server definitions stay there. Skill paths must be absolute. If the file is absent, no extra servers or skill folders are selected. An invalid or unreadable file fails the chat execution rather than widening access. Unselected plugin MCP servers detected at startup are disabled individually, so an unavailable one does not block the chat; selected servers must still pass verification. The built-in Bee Team MCP remains available, and Codex's normal skill discovery still applies. Edits take effect on the next provider session/turn; existing stored agent tool profiles are not changed and continue to apply to direct worker requests and automatic delivery.

Bee Team-owned Codex sessions also receive built-in coordination instructions on every turn. They include shared rules and guidance for the current team leader or worker, resolved from the conversation or task; requests without a team context do not assume a role. These rules are compiled into Bee Team and cannot be disabled through chat tools or settings. Existing Codex developer instructions are retained. If the effective Codex configuration cannot be read, the turn fails before submission. The instructions guide the model but do not guarantee compliance; service validations and harness approvals remain authoritative. External chats keep their existing MCP and skills workflow.

Creating teams, agents, boards and tasks in managed chats uses the read-only `get_creation_guidance` tool internally to obtain current creation contracts and workflow rules. The chat asks only for missing meaningful inputs and uses the existing creation operations within the user's authorization, without announcing or requiring creation skills. Guidance alone does not create records, start execution or provision sessions. This routing is supplied on new and resumed turns, including existing Bee Team Guide profiles with older default instructions; stored custom profiles are not rewritten. General leader/worker coordination skills and external installations remain available, and approvals, failures and tool audit evidence remain visible.

The fixed navigation rail uses compact icon buttons to leave more room for the workspace. Its main controls sit below the logo in the order Home, Chat, Sessions, Tasks (boards), Agents, and Teams; Home appears when enabled. Preferences stay at the bottom, and the rail scrolls on very short screens. When task filters dock on narrow screens, they use the space between the navigation and preferences when available. The destination buttons control the content panel: select the highlighted destination to close it, select it again to reopen the same page, or choose another destination to open that one. The content header also has a close button. A destination is highlighted only while its content is visible. The current page and drafts stay mounted, and the remaining panels use the available space.

Fenced Markdown code blocks with a recognized language are syntax-highlighted in the chat and other Markdown views, using the card background and text colors for the current light or dark theme. Blocks without a recognized language remain plain text; Mermaid diagrams retain their dedicated renderer. Managed chat tables use horizontal row separators without vertical lines. Hover over a chat table or focus it to copy its headers and rows as CSV using the button over its upper-right corner; the copy button is also available on touch devices.

The chat shows persistent messages, tool activity and per-action approvals. Assistant messages use the available width without a repeated logo. Reloading reconnects to persisted events. If an accepted turn becomes uncertain, use the explicit status check; it queries the original provider turn and never resends the message. Unknown outcomes without a saved provider ID stay unresolved. Native command/file/network approvals are implemented; OAuth and structured MCP forms are not.

Integrated execution requires local listener/peer and a trusted browser origin. A hosted panel must be explicitly allowlisted through `APP_CORS_ALLOW_ORIGINS`; MCP origins are configured separately with `MCP_ALLOWED_ORIGINS`. A wildcard CORS policy does not authorize remote execution. The default external-only workflow remains unchanged.

### Browse sessions

The **Sessions** button in the main navigation or chat header shows or hides the sessions panel, initially between the navigation and the content. It lists your chats with team leaders, newest update first; select one to reopen it in the chat panel, which shows its title, or start a new one with the pencil button. A new session uses the selected team, or the team currently open when no single team is filtered. The current session has a subtle background highlight. Filter by team, board (including "No board") and agent, switch to oldest update first, and group the list by up to three levels in any order, such as Team > Board > Agent. Filter choices are searchable and paginated, include an archived-only view, and allow up to 50 selections per category. Search by title and grouping apply to loaded sessions: scroll or use **Load more sessions** to include additional pages. Filter, sort, grouping and visibility choices are saved on this device. On screens up to 850 px wide the sidebar opens as a drawer.

New sessions started in chat have no board. HTTP and MCP can associate a session with an active board belonging to its team; existing and historical associations remain visible in Sessions after a board is transferred or archived. A session from a previous team leader opens as read-only history; start a new session to talk to the current leader. If a send cannot be confirmed, switching sessions within the app preserves its original message and idempotency key for an explicit retry. If a send is rejected while the chat is closed, reopening it restores the draft and error.

HTTP `GET /api/v2/agent-conversations` lists sessions; `GET` and `PATCH /api/v2/agent-conversations/{conversationId}` read and update an individual conversation. The corresponding MCP tools are `listAgentSessions`, `getAgentConversation` and `updateAgentConversation`.

### Metadata timestamp precision

New record creation and update metadata use microsecond precision, shared by PostgreSQL and SQLite, so write responses agree with subsequent reads. Existing timestamps, authored JSON, historical replay snapshots and portable transfer data retain their original precision; this does not migrate or normalize stored records.

### Managed-agent review flow

The review branch provides `/api/v2/agents/{agentId}/execution-config` and `/requests`, plus the matching MCP tools. Configure the leader in the team chat and send a request. Bee Team creates its own Codex thread on first use. New conversations have separate context; requests for the same agent queue serially. Choose the same conversation to continue. The panel supports request cancellation, original-request approvals and uncertain-outcome reconciliation; it keeps the saved left/right position. HTTP/MCP callers can still send requests directly to workers and poll their IDs, without claiming the agent or supplying provider IDs.

Existing data is preserved by additive SQLite/PostgreSQL migrations. Configuring a managed agent retires its legacy binding writes. Unconfigured legacy agents remain compatible pending the global cutover; old chat history remains available through legacy reads. No external Desktop session is imported. The installed Codex runtime and login still need to be configured locally.

Configure and inspect each worker's managed execution under the agent's Chats tab. Its managed history is read-only there, with approval, cancellation and reconciliation controls; external chat references remain separate. Pending worker approvals also appear in the team chat, even without an active leader conversation. They follow the worker's current team; if a worker has no team, its controls remain in the agent details. HTTP `GET /api/v2/teams/{teamId}/managed-approvals` and MCP `listTeamManagedApprovals` provide the same paginated list. Decisions use the original approval version and idempotency key.

Enter any existing MCP server names and skill directories needed for that work. These settings do not install tools or authenticate Codex. Without managed configuration, direct worker requests and automatic managed dispatch are not queued; team chat can start with its own defaults as described above. External MCP/skills workflows remain available. Conversation/worker-summary notices use the same durable queue, including a deferred outbox when the queue is full. Native provider output remains connected through completion; very large text is explicitly shortened at the public 65536-byte display limit. Images generated by Codex (PNG, JPEG or WebP, up to 20 MiB) are copied into Bee Team storage and shown below the agent's reply; only files inside Codex's `generated_images` directory are read. Fetch them with `GET /api/v2/agent-conversations/{conversationId}/messages/{messageId}/images/{imageId}`; HTTP and MCP message listings include each image's `id`, `mediaType` and `description`.

Files explicitly cited by the agent as output are shown as compact, full-width cards in the conversation. Bee Team copies regular files from the agent workspace's `output/` directory into its own storage (up to 20 MiB each, 16 references and 40 MiB per reply); local paths are not included in message responses. PDFs with a verified PDF signature can be previewed in a sandbox, and all stored files can be downloaded. Older citations can be recovered explicitly from the original local installation when the original file is still present. Recovery uses the message version and an idempotency key through HTTP `POST /api/v2/agent-conversations/{conversationId}/messages/{messageId}/recover-files` or MCP `recoverAgentConversationMessageFiles`; unavailable files remain visibly unavailable.

Managed agent workspaces: Bee Team always creates and reuses `~/.beeteam/workspaces/<agent-id>`. HTTP/MCP requests and chat settings cannot choose a project folder. The directory is checked and recreated if missing before every execution, including conversation resumption. Old stored paths are ignored for execution; existing files and conversation history are preserved. Files remain separate from the SQLite database.

The chat button is always available in navigation. HQ opens by default; the selected team and docked/floating state are restored after reload.

The chat panel places its history scrollbar at the far right across the full panel height. Only messages scroll; the heading and composer stay fixed, and activating voice still scrolls to the latest message once.

During a voice call, the two buttons beside the avatar independently mute the user's microphone and the assistant's playback. Muting playback keeps the response and saved transcript running. Each new call starts unmuted.

Team chats keep new-conversation creation in the sessions sidebar and no longer show the execution selector in the chat header.

The chat's three-dot button opens read-only session information: session title, team, assigned agent, current team leader, board and activity dates. It docks inside a chat wider than half the window when at least 640px are available; otherwise it floats at the right inside the chat. Closing it preserves the conversation and draft. Team and leader metadata no longer occupy permanent chat header rows.

When a visible board, team or task belongs to a different chat leader, a dismissible suggestion above the composer offers a new conversation or the latest writable conversation for that team and its current leader. Tasks resolve through their board. Navigation alone never switches the chat or creates a session; lists and hidden content do not show the suggestion.

The app opens directly to chat, without a separate onboarding page. On entry, the selected conversation remains available; use Hive to open boards, agents and teams. The sidebar Home button always opens a fresh, empty chat and clears its draft, without creating a session. The first sent message, a starter suggestion, or starting voice creates the session. Returning Home preserves the current voice call in its original conversation and shows floating controls; saved conversations remain available in Sessions.

Interface text and headings use locally bundled Source Sans 3; code keeps JetBrains Mono. The chat access picker uses compact text and reserves only icon-sized space for the selection indicator. Agent preparation, execution and configuration indicators reuse the standard theme-aware Bee Team outline logo. The chat welcome screen uses a subtle, theme-aware Bee Team logo watermark above its heading, guidance and starter actions. The welcome suggestions are Create a team, Create an agent and Create a board. Starter buttons keep their position and background on hover, strengthening only their theme-neutral border. Panel drag and resize highlights use subtle theme-neutral colors. The chat always remains available. The navigation sidebar has no chat toggle; floating and restoring are controlled from the chat header, which also holds the sessions toggle. The restore icon is a simple window outline. The float action is shown only when another content panel is open; the Sessions sidebar alone does not expose it. Dragging the docked chat resize border below its minimum width also turns it into a floating window. Reaching the minimum alone keeps it docked. Retracting the docked panel turns the same mounted conversation into a draggable floating window; its restore button docks it again. Drafts and live voice continue across both modes. The floating chat is gently attracted to six positions inside the content area: the four corners and the centers of the top and bottom edges. Releasing the header smoothly settles it at the nearest position, respecting reduced-motion preferences. Coordinates are saved on this device and kept inside the content area when it resizes. Escape cancels an active drag.

Floating chat borders and corners resize the window without restarting the conversation or voice. Floating dimensions are saved separately from the docked panel width, constrained to the content area, and restored when floating again. Focus a resize edge and use arrow keys for keyboard resizing; Escape cancels an active pointer resize.

Double-click the floating chat header to hide the history and show only the header and message composer (plus active voice controls); double-click again to restore the previous expanded dimensions and history. Dragging, magnetic positions and resizing are limited to the available content area, excluding the navigation rail, Hive navigation and visible sessions sidebar. Hiding the content area docks the chat automatically; floating it again reveals the content area. In floating mode, session information opens in a separate panel anchored beside the chat, following its movement without expanding a compact chat or shifting messages. It chooses the side with available room and stays within the content area; narrow layouts use a bounded overlay. Docked chat retains its internal information sidebar.

Listing cards reserve space for their header and footer; description previews shrink within the fixed card height so timestamps and action icons remain visible.
