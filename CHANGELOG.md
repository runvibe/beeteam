# Changelog

## Unreleased

- Define proposed Bee Team-managed agent contracts, strict request DTOs, HTTP/MCP parity fixtures and generated frontend types. Runtime activation and legacy session-binding retirement remain pending.

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
