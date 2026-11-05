# Bee Team documentation site

## Goal and entry points

A visitor can open Documentation from the landing page or the app, install Bee Team, connect their harness, and coordinate two workers in separate chats. Treat this as a first-class page of the site. It must open before the visitor installs the local API.

Use `/guide/` for the overview and `/guide/<topic>` for articles on both the hosted site and the embedded UI. The Rust service already uses `/docs` for Swagger. Preserve the standalone `/install` guide consumed by assistants, the `/install.json` release manifest, and the landing installation anchor. Add a human-readable link between the landing's installation section and the detailed download guide.

## Navigation and layout

Use the Bee Team logo, Manrope, theme and language controls, thin icons, and a link to open the app. On desktop, keep a left-hand topic menu and a readable article column on the right. Group the menu by the visitor's task. Mark the current article, link directly to headings, and offer previous/next navigation. On mobile, use a “Contents” button that opens the same menu and returns focus to the article after selection. Support keyboard navigation, direct URLs, refresh and browser Back.

| Menu group | Articles | Reader outcome |
| --- | --- | --- |
| Start here | What is Bee Team?; How Bee Team works | Understand the problem, purpose, expected benefits and free/open-source distribution model, then learn the roles and shared records. |
| Installation | Download and install; Connect your harness; Verify or update | Choose an OS and CPU, find a verified release or source build, run the local service, connect MCP and check readiness. |
| Using Bee Team | Your first team; Coordinate parallel tasks; Review results | Activate the skills, create the team and board, assign work, and review the recorded results. |
| Reference | Runtime and storage; Troubleshooting | Locate SQLite data, choose hosted or local UI, and diagnose common setup problems. Link to the existing API reference where appropriate. |
| Advanced | Binary configuration; MCP integration; MCP tool catalog | Look up every runtime setting and its effects, connect a client, and discover the tools available in a given release. |

## What is Bee Team?

Make `/guide/about` the first article under Start here. Explain why Bee Team was built: teams can divide work across several agent chats, but a decision made in one chat can be missed by another. A lead assigns independent tasks, each worker keeps the context of its own session, and the board records the plan, results and decisions that affect other workers. Use one concrete example: a worker verifying a build records a packaging issue that the worker preparing release notes needs to know about.

Explain what users can expect: independent tasks can advance simultaneously, decisions have a traceable home, and workers can consult the information they need instead of replaying every chat. Present better use of time and tokens as design goals; substantiate numerical claims with measurements. Explain that Bee Team itself is free and is intended for open-source distribution. Distinguish this from the cost of a user's harness or model provider. Link the governing software license and separate brand terms when published; until then, state their status as in the README. Preserve the approved slogan.

## Advanced reference

- **Binary configuration** (`/guide/reference/environment`): inventory every supported runtime environment variable, including indirect reads through parsing helpers, logging and telemetry configuration, and OS-dependent location discovery. Distinguish first-class settings from platform environment inputs and build/test-only settings. For each supported setting document the exact name, accepted values, units, default when absent, behavior on invalid input, dependencies or precedence, when it takes effect, and an observable result. Cover HTTP binding and CORS, body limits, SQLite/PostgreSQL, embedded UI, MCP transport, telemetry, and portable-transfer paths, limits and retention. Include PowerShell and POSIX examples for changing the port, enabling the panel, and selecting a database. Explain startup and restart using an isolated example configuration. Verify entries against the release source and flag additions or removed keys in CI.
- **MCP integration** (`/guide/reference/mcp`): trace one real request from the harness to the local binary and back. Document transport, default and customized endpoint, feature/enablement requirements, origin settings, client registration, discovery, and a read-only first call. Explain tools, resources and prompts, declared actor metadata, version conflicts and idempotency where applicable. Link to the existing harness-specific installation steps.
- **MCP tool catalog** (`/guide/reference/mcp/tools`): generate a searchable, grouped index and stable per-tool anchors from the release's checked-in `docs/mcp-catalog.json`. Publish every tool's exact name, purpose, input schema, required fields, read/write behavior and side effects. Supplement with verified return examples and errors from the service contracts. Show which operations depend on optional capabilities and how to check the tools advertised by the running server. List resources and prompts separately. Validate the generated catalog against `cargo run --locked --features mcp --example mcp_catalog` and test representative calls with temporary data. Embed the reference in the site build so it is readable before installation.

**Editorial acceptance:** both locales link the About article to the first-team tutorial. The environment reference accounts for every discovered runtime setting; the tool index matches the release catalog by name and schema. A reader can change the binary port and reconnect their harness using only the guide, then look up a tool directly by name.

## Adaptive harness instructions

Use the same names and icons as the landing: Codex, Claude Code, GitHub Copilot CLI, and Other. On the first visit show common prerequisites and invite a choice before displaying provider-specific commands. Carry a landing choice into the guide. After selection, keep the same article, step, focus and scroll position while the relevant instructions change. Allow switching at any step. Shareable URLs such as `/guide/first-team?harness=codex#start-the-lead` take precedence over a saved preference. Keep OS selection independent of harness selection.

Define the tutorial once. Give each variable step a named slot with variants for each supported harness. Distinguish **Run in your terminal**, **Paste into your lead chat**, **Paste into a new worker chat**, and **Check in Bee Team**. Every runnable block has a copy action, prerequisites and an observable result. Translate the surrounding text into English and Portuguese; preserve literal commands, skill IDs and paths. Show the exact skill invocation supported by the selected harness.

Example: in the lead step, Codex can show “Use $get-a-team-lead to create a team for this release.” For other clients use their documented skill invocation or an explicit natural-language prompt for a discoverable skill. Do not generate variants by prefix substitution. Validate actual CLI/IDE scope and version before publishing a command; offer a manual verification path for “Other.”

## Guided example

Use one release preparation scenario throughout:

1. Install or build Bee Team on the selected platform. Start the service and verify its identity and version.
2. Register MCP in the chosen harness, discover the skills, and perform a read-only check. Describe the expected response even for an empty board list.
3. Open the lead chat, invoke Get a Team Lead, create a release team and board, and agree on two deliverables: release notes and build verification.
4. Create two workers, assign one task to each, and open each in its own chat using the selected harness. Show a different prompt for each task. Each worker receives its scope, references and expected result.
5. On the board, follow both tasks in parallel. One worker records draft notes, the other records build evidence. Show how the lead handles a blocker or shares a decision relevant to both.
6. Review both results against the plan. State what the reader should now see in Bee Team. Keep the example illustrative; copying a prompt is the visitor's choice and browsing the guide performs no writes.

## Implementation sequence and ownership

1. **Documentation Worker:** map the guide articles to the English README and guides merged in PR #31. Use the versions on main when importing content. Keep one maintained source per factual instruction and a tested set of harness variants. Coordinate PT translations of reader-facing prose.
2. **Frontend Worker:** build the guide layout and accessible navigation, integrate links from landing/app, and implement route, locale, preference and anchor handling. Reuse existing Markdown and copy controls where compatible with links, code blocks and diagrams.
3. **Documentation + Frontend:** integrate the download guide and tutorial. Only offer a binary when the manifest has a verified asset for that OS/architecture. When a release is missing, show the source-build path. Use the approved setup skill instructions as the command source.
4. **Distribution:** ensure guide deep links work on Cloudflare Workers, Vite and the embedded distribution. Resolve static assets and links from nested pages. Verify that guides remain readable when the local API is offline and that Swagger, install instructions and the release manifest still return their intended content.
5. **Acceptance:** check direct links, mobile navigation, keyboard focus, clipboard contents, language/theme switching, harness switching mid-tutorial and unavailable releases. Run the example using isolated data. Record actual OS/client coverage separately from simulated rendering; label unverified variants and avoid claiming live acceptance for clients that were not exercised.

The first release is ready when a new reader can reach the guide from the site, choose a harness and follow the same example through two assigned worker tasks using only the displayed steps.
