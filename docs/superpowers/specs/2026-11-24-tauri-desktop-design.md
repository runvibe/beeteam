# Bee Team Desktop (Tauri) — design

Date: 2026-11-24
Status: approved
Supersedes: nothing. This is a fresh implementation; PR #54 is intentionally not reused.

## Goal

Run the current Bee Team (API, MCP, embedded UI) as a native macOS desktop window using Tauri 2, for local development use (`cargo run` / `cargo tauri dev` / unsigned `cargo tauri build`). Signed or notarized installers, Windows, Linux, and CI packaging are out of scope.

## Architecture

- New standalone crate `desktop/` (Tauri 2). The root crate stays a single package; `desktop/` depends on it by path with the `embedded-ui` feature. Root `cargo build --locked` / `cargo test --locked` are unaffected.
- The server runs **in-process**. Startup currently in `src/main.rs` moves into a library entry point (for example `beeteam::server::run(config, frontend_mode, listener, shutdown)`) that both `src/main.rs` and the desktop app call. There is no sidecar binary, no child process, and no parent-pipe protocol.
- The embedded UI is produced the same way as the single-binary distribution: the frontend output from `scripts/build-distribution.mjs` is supplied through `BEE_FRONTEND_DIST` with its build metadata. Hash verification and the "no SPA fallback for API/MCP or missing assets" rule are unchanged.

## Runtime flow

1. Load `~/.beeteam/desktop.env` with dotenv semantics if it exists. Variables already present in the process environment win. Without the file, `BEE_SESSION_INSTALLATION_ID` is normally unset, so the integrated Codex chat is disabled and the rest of the app works.
2. Build `AppConfig` from the environment. The database follows the current defaults (SQLite at `~/.beeteam/beeteam.sql` unless overridden). The frontend mode is forced to embedded.
3. Bind `127.0.0.1:0` (loopback, ephemeral port) and start the server on the Tauri async runtime.
4. Open one window at `http://127.0.0.1:<port>/app/`. UI and API share the origin, so the existing loopback/origin execution boundary applies unchanged. The window does not need Tauri IPC.
5. On app exit, trigger graceful server shutdown and wait with a bounded timeout.
6. Single instance: a second launch focuses the existing window instead of starting another server.

Not included: tray icon, deep links, autostart, auto-update, and in-app editing of `desktop.env`.

## Error handling

- If startup fails (invalid configuration, database open, migration, or port bind), show a native error dialog with the error message and exit. Do not retry silently.
- If `desktop.env` is unreadable or malformed, report it as a startup error and do not ignore it partially.
- Existing safety rules still apply: never convert or reset existing databases, never resend uncertain operations, and never take over external sessions.

## Known limitation

Running the desktop app and a CLI `beeteam` server at the same time against the same database and installation ID is unsupported, because two integrated runtimes would claim the same installation. Document this; do not add cross-process locking in this iteration.

## Testing

- Root: `cargo build --locked` and `cargo test --locked` (the refactored startup must keep the CLI behavior identical).
- Desktop: `cargo build` inside `desktop/`.
- Manual macOS check: launch the app, confirm `/health` (or the existing info endpoint) responds on the chosen port, the UI loads in the window, a second launch focuses the first, and quitting leaves no listening port behind.

## Documentation

README section for running the desktop app (prerequisites, `desktop.env` keys, limitation above) and a CHANGELOG entry under Unreleased.
