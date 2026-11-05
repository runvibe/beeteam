# Bee Team project documentation plan

## Outcome

A first-time visitor can explain what Bee Team coordinates, choose a working installation path for their platform, connect a harness over MCP, and run two independent tasks in separate chats. A contributor can trace the same actions from the UI or MCP to persistent storage. The README is the front door. Each substantial topic has a linked English guide in the repository.

## 1. Inventory and editorial migration

Map every heading and inbound link in the existing README to its new destination before rewriting it. Classify each item as current guidance, contract reference, historical verification, or superseded instruction. Keep useful historical evidence in dated records. Provide a replacement for linked anchors and update internal references. Inventory Markdown throughout the repository, including public guides, contributor instructions, plans and verification notes. Track remaining translations explicitly. Preserve identifiers, paths, commands, quoted evidence, fixtures and user-authored examples when translation would change their meaning. Keep generated API and MCP references reproducible from their sources.

## 2. Design the README

Open with the official hexagonal logo as a repository-relative image with alt text. Locate the canonical artwork; if the UI only draws it as a component, export an equivalent SVG to the repository and check it in both GitHub themes. Use the title **Bee Team** and the approved slogan. Follow with a short motivation: the lead divides work, workers execute independent tasks simultaneously in their own chats, and the team records decisions and dependencies on the board. Explain the benefit of focused context without promising measured token or performance savings.

Order the remaining sections as Table of contents, How it works, Quick start, Supported platforms, Connect your harness, Architecture and storage, Development, Troubleshooting, and License and brand. Each section gets a short explanation and a relative link to the detailed guide. Show one working path to the first task in the README itself.

## 3. Write the internal guides

Suggested paths below describe editorial responsibilities. Reuse a current guide when it already serves the same purpose.

| Guide | What the reader should be able to do |
| --- | --- |
| `docs/README.md` | Choose between installing, using, operating and contributing. Find current contracts separately from historical records. |
| `docs/guides/installation.md` | Choose a released binary or a source build. Provide separate Windows PowerShell and macOS/Linux shell examples, prerequisites, architecture, checksum, startup, readiness, stop/restart and update. List a binary as downloadable only after checking the matching release asset. |
| `docs/guides/first-team.md` | Create a team, lead, workers, board and tasks. Walk through a release where one worker prepares release notes while another validates the build. Show what goes in each chat, how the lead reviews both results, and what happens if one task blocks the other. |
| `docs/guides/mcp.md` | Register the server, connect to the configured endpoint (default `http://127.0.0.1:59865/mcp`), discover tools/resources/prompts and verify with a read-only call. Give tested steps for Codex, Claude Code and GitHub Copilot, identifying the client variant and configuration scope. |
| `docs/guides/skills.md` | Install and invoke Setup Bee Team, Get a Team Lead and Get a Worker. Explain first-time installation, existing installations, upgrades, chat identity, role icons, and the difference between an installed skill and an MCP resource. Link to the maintained packages. |
| `docs/guides/architecture.md` | Follow one task update from React or an MCP client through the Rust routes, DTOs, services, repositories and SQLx to the database. Explain where the harness runs the agent, where chat context lives, and which records Bee Team shares. |
| `docs/guides/storage.md` | Locate the default SQLite database (`~/.beeteam/beeteam.sql`), configure another path or PostgreSQL, understand migrations and existing data, and find the portable transfer guide. Explain safe backup and restore using an empty destination. |
| `docs/guides/runtime.md` | Choose the hosted UI, embedded UI or Vite development UI. Explain loopback, browser permission, API version discovery, required and optional updates, and how to start API and MCP alone or enable `BEE_FRONTEND_MODE=embedded`. Include a verified configuration table. |
| `docs/guides/development.md` | Build and test the Rust and frontend projects, regenerate contracts, package a native distribution, and find contribution conventions. Distinguish local SQLite tests from tests requiring an isolated PostgreSQL 18 instance. |
| `docs/guides/troubleshooting.md` | Diagnose service unreachable, port in use, browser permission, version mismatch, missing platform asset, missing MCP tools, skill discovery and database permissions. For each symptom give a check, expected result and recovery step. |
| License and brand | Link the actual software license and documented terms for the name, logo and visual identity. If a governing file is absent, record the owner decision required before publishing legal claims. |

## 4. Verify release and integration claims

Build a matrix by operating system **and architecture**. For each entry record build support, native smoke-test evidence and availability of a public release artifact separately. Check the GitHub release, install manifest and workflow against each other. Verify hosted URLs before sending users there. Where only a source build is confirmed, give that path and mark the release status explicitly.

Run each install example in an isolated environment. Verify readiness, MCP discovery, skill invocation, two independent worker chats, a persisted result on the board, restart persistence, and the optional embedded UI. Track platform/harness combinations that still lack direct verification. Use temporary databases for documentation checks.

## 5. Review and acceptance

- All maintained documentation reads naturally in English. Historical translations preserve the dates and status of the original evidence.
- Every former README section has a documented destination or a reason for retirement. Every new README section has a purpose, a usable entry point and a working link.
- The logo, table of contents, relative links, anchors and diagrams render on GitHub. Copied shell commands work in the stated shell.
- A new user can reach the first coordinated task without consulting old verification notes. A contributor can locate the domain model, runtime configuration, source contracts, test requirements and release procedure.
- Publish the documentation with a short verification matrix that states exactly which platforms, packages and harness connections were exercised.
