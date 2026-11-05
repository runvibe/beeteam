# Bee Team documentation site

## Goal and entry points

A visitor can open Documentation from the landing page or the app, install Bee Team, connect their harness, and coordinate two workers in separate chats. Treat this as a first-class page of the site. It must open before the visitor installs the local API.

Use `/guide/` for the overview and `/guide/<topic>` for articles on both the hosted site and the embedded UI. The Rust service already uses `/docs` for Swagger. Preserve the standalone `/install` guide consumed by assistants, the `/install.json` release manifest, and the landing installation anchor. Add a human-readable link between the landing's installation section and the detailed download guide.

## Navigation and layout

Use the Bee Team logo, Manrope, theme and language controls, thin icons, and a link to open the app. On desktop, keep a left-hand topic menu and a readable article column on the right. Group the menu by the visitor's task. Mark the current article, link directly to headings, and offer previous/next navigation. On mobile, use a “Contents” button that opens the same menu and returns focus to the article after selection. Support keyboard navigation, direct URLs, refresh and browser Back.

| Menu group | Articles | Reader outcome |
| --- | --- | --- |
| Start here | Overview; How Bee Team works | Understand the lead, independent worker chats, the shared board and what each worker records. |
| Installation | Download and install; Connect your harness; Verify or update | Choose an OS and CPU, find a verified release or source build, run the local service, connect MCP and check readiness. |
| Using Bee Team | Your first team; Coordinate parallel tasks; Review results | Activate the skills, create the team and board, assign work, and review the recorded results. |
| Reference | Runtime and storage; Troubleshooting | Locate SQLite data, choose hosted or local UI, and diagnose common setup problems. Link to the existing API reference where appropriate. |

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

1. **Documentation Worker:** map the guide articles to the English README and guides in PR #31. Reconcile that PR before importing content. Keep one maintained source per factual instruction and a tested set of harness variants. Coordinate PT translations of reader-facing prose.
2. **Frontend Worker:** build the guide layout and accessible navigation, integrate links from landing/app, and implement route, locale, preference and anchor handling. Reuse existing Markdown and copy controls where compatible with links, code blocks and diagrams.
3. **Documentation + Frontend:** integrate the download guide and tutorial. Only offer a binary when the manifest has a verified asset for that OS/architecture. When a release is missing, show the source-build path. Use the approved setup skill instructions as the command source.
4. **Distribution:** ensure guide deep links work on Cloudflare Workers, Vite and the embedded distribution. Resolve static assets and links from nested pages. Verify that guides remain readable when the local API is offline and that Swagger, install instructions and the release manifest still return their intended content.
5. **Acceptance:** check direct links, mobile navigation, keyboard focus, clipboard contents, language/theme switching, harness switching mid-tutorial and unavailable releases. Run the example using isolated data. Record actual OS/client coverage separately from simulated rendering; label unverified variants and avoid claiming live acceptance for clients that were not exercised.

The first release is ready when a new reader can reach the guide from the site, choose a harness and follow the same example through two assigned worker tasks using only the displayed steps.
