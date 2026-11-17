# Persistent chat side panel

**Goal:** Keep the integrated leader chat beside app navigation, with its side selectable in Settings.
**Approved design:** right by default, left/right preference saved locally; independent scroll, resize and collapse; preserve the mounted conversation and draft across navigation and side changes. Narrow screens use a full-height panel with a close action.
**Architecture:** shell owns the panel; a dedicated Zustand store owns team selection, visibility and persisted layout preferences. API/session contracts remain unchanged.

- [x] Add tests for preference persistence, width bounds and chat state surviving collapse/side changes.
- [x] Add panel store, shell layout and team chat entry point; preserve existing chat deep links.
- [x] Add PT/EN Settings choice, accessible resizing and responsive styles.
- [x] Validate frontend tests/build/i18n, cargo build/test and local UI; update README and commit for PR review only.

Validation: 725 frontend tests passed with two workers; production build, typecheck and i18n audit (226 files) passed. Cargo build and full SQLite test run passed. Browser review confirmed switching to Left in Settings and navigating to Boards while the same panel remained open. No session creation or replacement was performed.
