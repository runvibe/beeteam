# Changelog

## Unreleased

- Suggest the relevant team leader from board, team and task pages, with explicit new-chat or latest-valid-conversation actions.

- Keep the sessions toggle only in the chat header and use a simple window outline for restoring floating chat.

- Keep chat suggestion buttons stationary on hover.

- Add a subtle, theme-aware Bee Team logo watermark above the chat welcome heading.

- Make Home open a fresh chat without eagerly creating a session; send starter suggestions directly and keep late replies from reopening a previous chat.

- Use subtle theme-neutral highlights for panel dragging and resizing.

- Compact chat-access menu typography and prevent its selection indicator from squeezing descriptions.

- Remove the decorative hexagon above the chat welcome heading.

- Keep listing-card footers visible by fitting description previews into the remaining card height.

- Remove the redundant chat toggle from the navigation sidebar; retain floating and restoring in the chat header.

- Show floating-chat session information in an external anchored panel without expanding compact chat or shifting its contents.

- Toggle compact floating chat with a header double-click, preserving live voice and drafts, and constrain floating movement and resizing to the content area outside navigation sidebars.

- Resize floating chat from its borders and corners without visible grips while preserving the conversation, with keyboard controls and independently saved floating dimensions.

- Gently attract and smoothly settle the floating chat at six positions: corners and the top/bottom centers, respecting reduced motion and using a smaller, subtler floating-window shadow.

- Keep the chat alive as a draggable floating window when retracted, with saved screen position and a control to dock it again.

- Move team and leader metadata into a responsive, read-only session information sidebar opened from the chat's three-dot button.

- Remove the request selector and duplicate new-conversation button from the team chat header; new conversations remain available in Sessions.

- Add independent microphone and assistant playback mute buttons beside the live voice avatar.

- Extend the chat history scrollbar across the full panel height at the right edge while keeping heading and composer fixed.

- Choose the voice for future calls in general settings, using the installed Codex voice list and a device-local preference.

- Scroll to the end of the chat once when voice is activated, then preserve manual scrolling.

- Keep the chat viewport fixed during voice calls, with messages scrolling beneath the floating avatar and extra internal bottom padding.

- Save user and assistant voice transcripts in the main conversation timeline, with history restored after calls and page reloads. Voice origin remains recorded without a visible message label.

- Place the transparent amber voice avatar above the composer and combine microphone, text send and end-call actions in its existing button. Keep audio-reactive bars and reduced-motion support.

- Add live voice conversations to managed chats, with clear execution requests delegated to Codex while the voice session continues.

- Show Codex reasoning summaries in team chats while the agent works; they collapse when the reply finishes and stay available in history. Raw model reasoning is never stored or displayed.
- Give Bee Team-owned Codex chats built-in, non-removable coordination guidance for leaders and workers, while preserving local developer instructions.
- Remove the web search and MCP permissions note from the chat access menu.
- Open new team chats without manually configuring the leader; the first message starts an owned session with default settings.
- Configure team chat MCP servers and additional skill folders through a local Bee Team TOML file instead of chat setup fields.
- Choose a per-chat Codex access mode below the team chat composer and set the default in global settings on this device. Full access requires confirmation; the Codex configuration option uses the local configuration.
- Place the main navigation buttons below the logo, keep preferences at the bottom, and allow the rail to scroll on short screens.
- Overlay the chat table copy button in the upper-right corner and make generated file cards fill the available width.
- Remove the keyboard shortcut hint from the managed chat composer.
- Order the navigation controls as Home, Chat, Sessions, and Hive. Hive groups Boards, Agents, and Teams in its own sidebar inside the content panel, turns into tabs on narrow screens, and reopens the last Hive section visited.
- Make the fixed navigation rail and its icon buttons 25% smaller.

- Clear the active destination highlight while the content panel is hidden.

- Move the panel layouts button to the navigation's bottom preferences.
- Close and reopen the content panel from its active destination button while keeping the current page and drafts.

- Copy chat tables as CSV using an accessible button shown on hover or focus.

- Remove vertical lines from Markdown tables in managed chat, keeping horizontal row separators.

- Remove the assistant logo beside chat messages, giving their content the full available width.

- Show managed-agent output files as compact chat cards with download and sandboxed PDF preview. Store explicitly cited files from the agent's `output/` directory with the conversation, and allow recovery of older citations on their original installation without exposing local paths.

- Highlight fenced Markdown code blocks with language-specific colors that follow the light or dark theme and use the standard card background; unsupported languages remain readable as plain code.

- Show images generated by managed agents in the chat. Bee Team stores a copy of each PNG, JPEG or WebP image with the conversation, so it survives Codex cleanup and transfers; open an image at full size in a new tab. HTTP `GET /api/v2/agent-conversations/{conversationId}/messages/{messageId}/images/{imageId}` returns the bytes, and message listings in HTTP and MCP include the image metadata. Leader chat still records image generation only as a tool step.

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
