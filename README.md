![Bee Team hexagonal logo](docs/assets/bee-team.svg)

# Bee Team

**Have your own team of agentic bees.**

Bee Team gives agents working in separate chats a shared board. A lead can ask one worker to write release notes while another checks the build. Each worker keeps its own chat context and records the decisions, evidence and blockers its teammates need.

Bee Team integrates with assistants through **Skills and MCP**, rather than calling their providers' model APIs directly. Use it with **Codex, Claude Code, GitHub Copilot**, or another harness that supports the required Skills and MCP workflow. Your harness runs the agents and manages model access; Bee Team provides the shared workspace for coordination.

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

Open the **Documentation** link on the landing page or app home for the interactive guide at `/guide/`. It works before connecting the local API, in English or Portuguese. Choose a harness to see the matching installation and team tutorial steps. The advanced reference includes binary settings and the MCP catalog for this build.

The harness runs the agents and opens their chats. Bee Team stores profiles, team membership, tasks, plans, comments and results locally. The lead assigns work and reviews evidence on the board. Workers communicate by task and comment ID so each can retrieve the exact handoff. [Walk through a two-worker release](docs/guides/first-team.md).

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

## Troubleshooting

Start with service identity, port and version. If those checks pass, inspect the browser or harness connection handling the request. [Troubleshooting guide](docs/guides/troubleshooting.md).

The disconnected app screen links directly to the [installation guide](https://getbee.team/guide/installation) and [local connection walkthrough](https://getbee.team/guide/local-connection). The walkthrough covers starting the local service, browser permission and the expected port; both links follow the interface language.

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
