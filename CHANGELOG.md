# Changelog

## Unreleased

- Show the current conversation title in team chat and navigate conversations from Sessions, with a shortcut in the chat header. Remove board and team selectors from managed chat; existing board associations and worker and legacy history remain available.

- Highlight the active session with a subtle background instead of a side border.

- Remove drag-grip icons from panel headers while retaining drag and keyboard controls.

- Rearrange the sessions, content and chat panels by dragging their headers or choosing one of six keyboard-accessible layouts with compact icon-only previews from the navigation. A blue preview shows the drag position, including the middle; the order is saved and drafts stay intact. Resize adjacent panels using their dividers or arrow keys while the navigation stays fixed; panel widths are saved and the chat remains limited to 80% of the viewport.

- Remove pointer-focus highlights from text fields, searches, and chat composers while retaining visible keyboard focus.

- Add a collapsible **Sessions** sidebar next to the main navigation that lists team-leader chats with title search, searchable filters by team, board and agent, update-time sorting, and up to three nested grouping levels in any order (for example Team > Board > Agent). Sessions load as you scroll; filter, sort, grouping and visibility choices are saved on this device, and narrow screens open a drawer. HTTP and MCP can associate a board with a session; historical boards remain visible after transfer, and previous leaders' sessions open read-only. Switching sessions preserves an uncertain send's original message and key for an explicit retry, while rejected drafts and errors are restored when reopening chat.

- Expand the chat panel to 80% of the viewport, keep wide conversations centered, move the chat toggle to the main navigation, and keep narrow content, detail views, and filters usable beside it. Apply a half-rem gutter to the content and its header, including the breadcrumb. Preserve the default HQ draft when the panel is closed and reopened.

- Drag the chat panel by its header to dock it on the left or right with a blue snap preview, choose its position with the layout menu, and resize it with a visible edge handle while it splits the screen with the content.

- Use a plain-text, multiline chat editor that preserves Markdown and existing keyboard shortcuts while removing rich formatting from pasted content.

- Address each team's chat to its leader, manage worker execution and read-only history from agent details, and review pending worker approvals in the team panel even without an active leader conversation. Approvals follow current team membership; direct worker requests through HTTP/MCP remain available.

- Redesign the agent chat as an AI-assistant thread: user messages in bubbles, agent replies with a hexagonal mark that pulses while work runs, inline status and approval cards, an auto-growing composer that sends with Enter, compact conversation/settings controls, and Bee Team HQ starter prompts for creating teams, agents and boards.

- Seed a protected **Bee Team HQ** team on every database, led by the **Bee Team Guide** agent and with a **Getting started** board, so a fresh installation opens a ready chat for creating teams, agents and boards. HQ resources are marked as system resources, cannot be archived or reassigned through HTTP/MCP, and an untouched seed does not block portable restore.

- Keep the chat entry point visible without a selected team and restore the selected team and panel visibility after reload.

- Fix integrated agent workspaces to `~/.beeteam/workspaces/<agent-id>`, recreate missing directories before execution, and remove folder selection from HTTP/MCP and chat. Preserve historical conversations and files in previously selected folders.

- Implement managed-agent requests and conversations through HTTP/MCP, durable per-agent queues, owned Codex execution, approvals/recovery, and the existing chat side panel. Preserve legacy history and reject binding changes after explicit managed configuration.

- Define proposed Bee Team-managed agent contracts, strict request DTOs, HTTP/MCP parity fixtures and generated frontend types. The runtime is available on the review branch; global legacy session-binding retirement remains pending.

- Restore internal scrolling on long detail pages inside the persistent chat workspace.

- Move integrated leader chat to a persistent, resizable side panel with a saved left/right position in Appearance settings.

- Generate new record metadata timestamps at microsecond precision so PostgreSQL write responses and subsequent reads agree, without rewriting existing data or replay snapshots.

- Add a team leader chat backed by Bee Team-owned Codex App Server sessions, with persistent history, streamed responses, cancellation and per-action approvals.
- Keep external MCP/skills sessions separate from integrated sessions in mixed teams. Create integrated worker sessions through the same HTTP and MCP lifecycle service.
- Configure integrated web search, command network access, native skills and selected local MCP servers without granting full filesystem access.
- Recover confirmed outcomes of uncertain chat turns by querying their original provider turn, without resending work. Unknown creation outcomes remain explicit and are never guessed.

- Clarify external and integrated session workflows in role/setup skills, including mixed teams, pending external messages and avoiding duplicate direct notifications.

- Keep truncated execution summary titles within their length limit.

- Deliver Conversation mentions to explicitly linked Codex sessions, track acknowledgements and uncertain outcomes, and notify the team leader once for each worker execution summary.
- Select team agents by name with @ mentions and inspect delivery state in the task Conversation.

- Match the default browser icon to the bold Bee Team outline.

## 0.1.4

- Long subtask lists scroll inside the task overview.

- The Plans and Timeline lists fit the visible panel as you scroll or resize. Event details use square corners and no outer border.

- Identify agents, teams, boards, and task metadata by their icons in the task detail sidebar.

- Copy the update request when the panel and API versions differ. The sidebar update indicator uses a more compact disc within the standard navigation button.

## 0.1.3

- Switching appearance reveals the new theme outward from the control you used.
- Available updates appear beside Home. Open the indicator to compare installed and available versions and copy an update request.
- Copy buttons keep their label and confirm success by changing the icon. Home includes shortcuts to documentation, teams, agents and boards.
- Links from the app carry the selected appearance into the website and documentation.
- Workers now route questions to their leader through task comments. The role skills and MCP describe how to write a short update on the task's current state.

## 0.1.2

- New work summaries accept up to 200 characters. Previously saved summaries are preserved.
- The hosted app offers a direct link to the local panel when it cannot connect.
- Cookie preferences are available in app settings, and chart points have a thinner hover outline.
