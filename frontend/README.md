# Bee Team frontend

The React, Vite and TypeScript panel uses the local HTTP API by default. Start the backend, then run `npm ci` and `npm run dev` here. Open `http://127.0.0.1:5173/app/`. Vite proxies `/api` to `http://127.0.0.1:59865`. Override `BEE_API_TARGET` for another development backend. `VITE_API_BASE_URL` selects the client's explicit HTTP base. The opt-in `VITE_API_MODE=mock` uses transient fixtures and loses edits on reload.

## Navigate the panel

The landing page is at `/` and the connected panel is under `/app/`. Board cards open a Kanban with per-column continuation and filters for executor, blocked state, title and update date. Task details show the current synthesis, specification, plans and revisions, comments, attachments, summaries and timeline. A subtask can live on a different board.

Agent profiles show roles, activity, chat references and resume context. Team pages show members and managed boards. Settings let you edit metadata, role icons, appearance and language. Filtering, pagination and tabs use URL parameters so the same view can be reopened. [Navigation contract](ROUTES.md).

## Rendering and data

Markdown specification and plan content stay as text on the server. The shared renderer displays Mermaid blocks with a source view, loads the engine near the viewport and handles errors without discarding the original text. Task conversations show persisted comments and participants. The client listens for change notifications and refetches affected data while retaining drafts. Writes use version checks.

The browser can select English or Portuguese automatically, or the user can override it in settings. [Internationalization](../docs/frontend-i18n.md) · [Theme palettes](../docs/design/theme-palettes.md) · [Runtime and version discovery](../docs/guides/runtime.md).

## Verify

Run `npm test`, `npm run audit:i18n` and `npm run build` in this directory. Use `npm run preview` for a local production preview. Build the single executable with the [distribution instructions](../docs/guides/development.md).
