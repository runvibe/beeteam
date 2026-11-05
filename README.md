![Bee Team hexagonal logo](docs/assets/bee-team.svg)

# Bee Team

**Have your own team of agentic bees.**

Bee Team gives agents working in separate chats a shared board. A lead can ask one worker to write release notes while another checks the build. Each worker keeps its own chat context and records the decisions, evidence and blockers its teammates need.

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

From a checkout with Rust 1.94 or later, a native build toolchain and Node.js 22.20+ with npm, run:

```sh
node scripts/build-distribution.mjs
```

Start the local panel from the repository root. Use an available loopback port and an intended database. On a fresh install, Bee Team creates a SQLite file in your home directory.

**Windows PowerShell**

```powershell
$env:BEE_FRONTEND_MODE = 'embedded'
.\target\release\beeteam.exe
```

**macOS or Linux**

```sh
BEE_FRONTEND_MODE=embedded ./target/release/beeteam
```

1. Check [local service info](http://127.0.0.1:59865/api/v1/info) and open the [local panel](http://127.0.0.1:59865/app/).
2. [Connect your harness](docs/guides/mcp.md) and [install the role skills](docs/guides/skills.md). In a lead chat, ask it to use **Get a Team Lead** to create a release team and board in your chosen project.
3. Approve a worker chat for release notes. After it confirms its profile and team, ask the lead to assign **Draft release notes** and record a comment describing the expected draft. Open that task on the board and follow its plan, comments and progress. [Continue to the second worker and review](docs/guides/first-team.md).

## Supported platforms

The release workflow targets Windows, Linux and macOS. On November 5, 2026 the repository had no GitHub Releases. Use the source build from a checkout you can access. See [installation and platform evidence](docs/guides/installation.md).

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

## License and brand

Bee Team is free to use. Its software and documentation are licensed under the [Apache License 2.0](LICENSE), including commercial use, modification and redistribution under its terms. The Bee Team name, logo and identified brand assets are reserved separately: see [the trademark policy](TRADEMARKS.md), [brand asset permissions](BRAND-ASSETS.md) and [NOTICE](NOTICE). Forks may reuse the code while using their own product identity. Third-party materials retain their own licenses, including the [Lucide artwork notice](docs/team-role-icons-LICENSE). Native release archives include the license, notices and brand terms; the setup helper preserves the allowlisted legal documents alongside the installed executable.

The Bee Team brand owner is Philippe Ferreira Assis Tecnologia da Informação LTDA (trade name: Philtech), CNPJ 59.845.514/0001-90. Third-party rights and contributor attribution remain unchanged.

[Documentation index](docs/README.md)
