# Bee Team Desktop (Tauri) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the current Bee Team server and embedded UI inside a native macOS Tauri 2 window, in one process.

**Architecture:** Extract the CLI startup from `src/main.rs` into a reusable library module, `beeteam::server`, with two phases. `prepare` connects, recovers, seeds, and builds the router; `serve` runs until a shutdown future resolves. A new standalone crate, `desktop/`, loads `~/.beeteam/desktop.env`, binds `127.0.0.1:0`, prepares the server, opens a window at `/app/`, and shuts the server down gracefully on exit.

**Tech Stack:** Rust 1.95, axum, tokio, Tauri 2 (`tauri`, `tauri-build`, `tauri-plugin-single-instance`, `tauri-plugin-dialog`), dotenvy, and the existing Node distribution scripts.

Spec: `docs/superpowers/specs/2026-11-24-tauri-desktop-design.md`

## Global Constraints

- Scope: macOS, local development only (`cargo run` / unsigned build). No signing, notarization, Windows/Linux, or CI.
- Server runs in-process. No sidecar, child process, or parent-pipe protocol.
- Root crate remains a single package (no `[workspace]`); root `cargo build --locked` and `cargo test --locked` must keep passing, and CLI behavior must not change.
- `desktop.env` is optional and explicit. Variables already in the process environment win. A malformed file is a startup error.
- Desktop always binds `127.0.0.1` on an ephemeral port and forces `FrontendMode::Embedded`.
- Never convert or reset existing databases. Never auto-resend uncertain operations. Never take over external sessions.
- No source file over 1000 lines. Keep transport, business, and persistence layers as they are; `server.rs` only composes them.
- Commits include the trailer `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.

---

### Task 1: Reusable server bootstrap (`beeteam::server`)

**Files:**
- Create: `src/server.rs`
- Modify: `src/lib.rs` (add `pub mod server;`)
- Modify: `src/main.rs` (delegate to `server`)
- Test: `tests/server_lifecycle.rs`

**Interfaces:**
- Produces:
  - `pub struct PreparedServer` (opaque)
  - `pub async fn prepare(config: AppConfig, frontend_mode: FrontendMode, listener: tokio::net::TcpListener) -> anyhow::Result<PreparedServer>`
  - `impl PreparedServer { pub fn local_addr(&self) -> std::net::SocketAddr; pub async fn serve<F>(self, shutdown: F) -> anyhow::Result<()> where F: Future<Output = ()> + Send + 'static }`
- Precondition: `config.port` must equal the listener's bound port. Callers that bind port 0 update `config.port` first. This keeps `create_router_with_frontend(state, &config, …)` consistent.

- [ ] **Step 1: Write the failing test** `tests/server_lifecycle.rs`

```rust
use beeteam::{
    config::{AppConfig, CorsConfig, DatabaseDriver, McpConfig},
    server,
    services::frontend::FrontendMode,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::test]
async fn prepared_server_serves_health_and_stops_on_shutdown() {
    let dir = tempfile::tempdir().unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let config = AppConfig {
        database_driver: DatabaseDriver::Sqlite,
        database_url: format!("sqlite://{}", dir.path().join("bee.sql").display()),
        host: "127.0.0.1".parse().unwrap(),
        port,
        cors: CorsConfig::Permissive,
        body_limit_bytes: 1024 * 1024,
        otel_enabled: false,
        mcp: McpConfig { enabled: false, path: "/mcp".into(), cors: CorsConfig::Permissive },
    };
    let prepared = server::prepare(config, FrontendMode::Disabled, listener).await.unwrap();
    assert_eq!(prepared.local_addr().port(), port);
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    let task = tokio::spawn(prepared.serve(async { let _ = rx.await; }));

    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .await
        .unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).await.unwrap();
    assert!(response.starts_with("HTTP/1.1 200"), "{response}");

    tx.send(()).unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), task)
        .await
        .expect("server must stop after shutdown")
        .unwrap()
        .unwrap();
    assert!(tokio::net::TcpStream::connect(("127.0.0.1", port)).await.is_err());
}
```

- [ ] **Step 2: Run it and verify it fails**

Run: `OTEL_ENABLED=false cargo test --locked --test server_lifecycle`
Expected: compile error `could not find server in beeteam`.

- [ ] **Step 3: Implement `src/server.rs`**

Move the body of `src/main.rs` (after telemetry init, through `axum::serve`) into these functions without changing behavior. `prepare` contains: DB connect, transfer config/recovery/maintenance task, onboarding seed, host/port runtime config, leader chat runtime, managed session runtime, `managed_agents().start()`, router build, and spawning the managed runtime task. `serve` runs `axum::serve(...).with_graceful_shutdown(shutdown)`.

```rust
//! Process bootstrap shared by the CLI binary and the desktop app.
use crate::{
    config::AppConfig, repositories::database::DatabaseRepository,
    routes::create_router_with_frontend, services::frontend::FrontendMode, state::AppState,
};
use anyhow::Result;
use axum::Router;
use std::{future::Future, net::SocketAddr};
use tokio::net::TcpListener;

pub struct PreparedServer {
    listener: TcpListener,
    router: Router,
    addr: SocketAddr,
}

pub async fn prepare(
    config: AppConfig,
    frontend_mode: FrontendMode,
    listener: TcpListener,
) -> Result<PreparedServer> {
    // (moved verbatim from main.rs: database, transfer, onboarding, runtime config,
    //  managed runtimes, router, managed runtime spawn, log lines)
    let addr = listener.local_addr()?;
    /* ... existing code, using `listener.local_addr()` as `actual` ... */
    Ok(PreparedServer { listener, router, addr })
}

impl PreparedServer {
    pub fn local_addr(&self) -> SocketAddr {
        self.addr
    }

    pub async fn serve<F>(self, shutdown: F) -> Result<()>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        axum::serve(
            self.listener,
            self.router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(shutdown)
        .await?;
        Ok(())
    }
}
```

The moved block is copied verbatim; the `/* ... */` marker is not literal code. Copy `main.rs` lines 13–95 exactly, replacing only the `TcpListener::bind` call with the supplied listener.

`src/main.rs` becomes:

```rust
use anyhow::Result;
use beeteam::{config::AppConfig, libs::telemetry, server};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let config = AppConfig::from_env()?;
    let frontend_mode = beeteam::services::frontend::FrontendMode::from_env()?;
    let _telemetry = telemetry::init_tracing(config.otel_enabled)?;
    let listener = TcpListener::bind(config.listen_addr()?).await?;
    server::prepare(config, frontend_mode, listener)
        .await?
        .serve(std::future::pending())
        .await
}
```

- [ ] **Step 4: Run the test and the full root suite**

Run: `OTEL_ENABLED=false cargo test --locked --test server_lifecycle` → PASS.
Run: `cargo build --locked && BEE_TEST_DRIVER=sqlite OTEL_ENABLED=false cargo test --locked` → all pass. PostgreSQL-only tests still need an isolated `BEE_TEST_DATABASE_URL`.

- [ ] **Step 5: Commit** `refactor: extract reusable server bootstrap`

---

### Task 2: Tauri desktop crate

**Files:**
- Create: `desktop/Cargo.toml`, `desktop/build.rs`, `desktop/tauri.conf.json`, `desktop/icons/icon.png` (copy of `frontend/public/icons/bee-512.png`), `desktop/src/main.rs`, `desktop/src/env.rs`, `desktop/src/server.rs`
- Create: `scripts/build-desktop.mjs`
- Modify: `scripts/build-distribution.mjs` (export `buildEmbeddedFrontend(root)`; reused by desktop)
- Modify: `.gitignore` (add `desktop/gen/`)
- Seed `desktop/Cargo.lock` from the root `Cargo.lock` so that shared dependencies resolve to the same versions.

**Interfaces:**
- Consumes: `beeteam::server::{prepare, PreparedServer}`, `beeteam::config::AppConfig`, `beeteam::services::frontend::FrontendMode`, `beeteam::libs::telemetry::init_tracing`.
- Produces: `env::load_desktop_env(path: &Path) -> anyhow::Result<bool>`; `server::start() -> anyhow::Result<RunningServer>` with `RunningServer { url: String, shutdown: oneshot::Sender<()>, task: JoinHandle<anyhow::Result<()>> }`.

- [ ] **Step 1: Write failing env tests** in `desktop/src/env.rs`

```rust
#[cfg(test)]
mod tests {
    use super::load_desktop_env;
    use std::io::Write;

    #[test]
    fn missing_file_is_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!load_desktop_env(&dir.path().join("desktop.env")).unwrap());
    }

    #[test]
    fn loads_values_without_overriding_process_env() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("desktop.env");
        let mut f = std::fs::File::create(&path).unwrap();
        writeln!(f, "BEE_DESKTOP_TEST_NEW=from-file\nBEE_DESKTOP_TEST_KEEP=from-file").unwrap();
        unsafe { std::env::set_var("BEE_DESKTOP_TEST_KEEP", "from-process") };
        assert!(load_desktop_env(&path).unwrap());
        assert_eq!(std::env::var("BEE_DESKTOP_TEST_NEW").unwrap(), "from-file");
        assert_eq!(std::env::var("BEE_DESKTOP_TEST_KEEP").unwrap(), "from-process");
    }

    #[test]
    fn malformed_file_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("desktop.env");
        std::fs::write(&path, "NOT VALID LINE WITHOUT EQUALS'\n").unwrap();
        assert!(load_desktop_env(&path).is_err());
    }
}
```

- [ ] **Step 2: Create the crate skeleton and confirm the tests fail**

`desktop/Cargo.toml`:

```toml
[package]
name = "beeteam-desktop"
version = "0.1.4"
edition = "2021"
publish = false

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
beeteam = { path = "..", features = ["mcp", "embedded-ui"] }
tauri = { version = "2", features = [] }
tauri-plugin-single-instance = "2"
tauri-plugin-dialog = "2"
tokio = { version = "1", features = ["sync", "time", "net"] }
dotenvy = "0.15"
anyhow = "1"
tracing = "0.1"

[dev-dependencies]
tempfile = "=3.27.0"
```

`desktop/build.rs`: `fn main() { tauri_build::build() }`

`desktop/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Bee Team",
  "version": "0.1.4",
  "identifier": "com.runvibe.beeteam.desktop",
  "build": {},
  "app": { "windows": [], "security": { "csp": null } },
  "bundle": { "active": true, "targets": ["app"], "icon": ["icons/icon.png"] }
}
```

Run: `BEE_FRONTEND_DIST=<built dist> cargo test --manifest-path desktop/Cargo.toml env::` → FAIL (`load_desktop_env` not found).

- [ ] **Step 3: Implement `env.rs`**

```rust
use std::path::Path;

/// Loads optional desktop configuration. Existing process variables win.
pub fn load_desktop_env(path: &Path) -> anyhow::Result<bool> {
    match dotenvy::from_path(path) {
        Ok(()) => Ok(true),
        Err(dotenvy::Error::Io(e)) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(anyhow::anyhow!("Cannot load {}: {e}", path.display())),
    }
}
```

- [ ] **Step 4: Implement `desktop/src/server.rs`**

```rust
use beeteam::{config::AppConfig, server, services::frontend::FrontendMode};
use std::net::{IpAddr, Ipv4Addr};
use tokio::{sync::oneshot, task::JoinHandle};

pub struct RunningServer {
    pub url: String,
    pub shutdown: oneshot::Sender<()>,
    pub task: JoinHandle<anyhow::Result<()>>,
}

pub async fn start() -> anyhow::Result<RunningServer> {
    let mut config = AppConfig::from_env()?;
    config.host = IpAddr::V4(Ipv4Addr::LOCALHOST);
    let listener = tokio::net::TcpListener::bind((config.host, 0)).await?;
    config.port = listener.local_addr()?.port();
    let prepared = server::prepare(config, FrontendMode::Embedded, listener).await?;
    let url = format!("http://{}/app/", prepared.local_addr());
    let (shutdown, rx) = oneshot::channel::<()>();
    let task = tokio::spawn(prepared.serve(async {
        let _ = rx.await;
    }));
    Ok(RunningServer { url, shutdown, task })
}
```

- [ ] **Step 5: Implement `desktop/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod env;
mod server;

use std::{sync::Mutex, time::Duration};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[derive(Default)]
struct ServerSlot(Mutex<Option<server::RunningServer>>);

fn boot() -> anyhow::Result<(server::RunningServer, Option<beeteam::libs::telemetry::TelemetryGuard>)> {
    let home = std::env::home_dir().ok_or_else(|| anyhow::anyhow!("Cannot resolve user home"))?;
    env::load_desktop_env(&home.join(".beeteam").join("desktop.env"))?;
    let otel = beeteam::config::otel_enabled_from_env();
    let telemetry = beeteam::libs::telemetry::init_tracing(otel)?;
    let running = tauri::async_runtime::block_on(server::start())?;
    Ok((running, Some(telemetry)))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(ServerSlot::default())
        .setup(|app| {
            match boot() {
                Ok((running, telemetry)) => {
                    let url = running.url.parse()?;
                    app.state::<ServerSlot>().0.lock().unwrap().replace(running);
                    app.manage(Mutex::new(telemetry));
                    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                        .title("Bee Team")
                        .inner_size(1280.0, 800.0)
                        .build()?;
                }
                Err(error) => {
                    let handle = app.handle().clone();
                    app.dialog()
                        .message(format!("{error:#}"))
                        .title("Bee Team could not start")
                        .kind(MessageDialogKind::Error)
                        .show(move |_| handle.exit(1));
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Bee Team desktop")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(running) = app.state::<ServerSlot>().0.lock().unwrap().take() {
                    let _ = running.shutdown.send(());
                    let _ = tauri::async_runtime::block_on(tokio::time::timeout(
                        Duration::from_secs(5),
                        running.task,
                    ));
                }
            }
        });
}
```

Before relying on these APIs, adjust names to the actual APIs: the telemetry guard type returned by `init_tracing`, `otel_enabled_from_env` visibility, and the Tauri 2 single-instance callback signature. Keep the behavior identical.

- [ ] **Step 6: Build script** `scripts/build-desktop.mjs`. Refactor `build-distribution.mjs` to export the shared frontend build:

```js
export function buildEmbeddedFrontend(root) {
  const staging = stageFrontend(root);
  if (process.platform === "win32")
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm ci --include=dev"], staging);
  else run("npm", ["ci", "--include=dev"], staging);
  run(process.execPath, ["scripts/build-embedded.mjs"], staging);
  return resolve(staging, "dist");
}
```

Keep the CLI `main` behavior identical by calling it. Then use it in `scripts/build-desktop.mjs`:

```js
// Builds the macOS desktop app (unsigned, local use). Pass --run to launch it.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildEmbeddedFrontend } from "./build-distribution.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = buildEmbeddedFrontend(root);
const args = process.argv.includes("--run") ? ["run"] : ["build", "--release"];
const result = spawnSync(
  "cargo",
  [...args, "--locked", "--manifest-path", resolve(root, "desktop", "Cargo.toml")],
  { cwd: root, stdio: "inherit", env: { ...process.env, BEE_FRONTEND_DIST: dist } },
);
process.exit(result.status ?? 1);
```

- [ ] **Step 7: Run desktop tests and build**

Run: `cp Cargo.lock desktop/Cargo.lock && node scripts/build-desktop.mjs` → builds `desktop/target/release/beeteam-desktop`.
Run: `BEE_FRONTEND_DIST=$PWD/.local/distribution/frontend/dist cargo test --locked --manifest-path desktop/Cargo.toml` → 3 env tests PASS.

- [ ] **Step 8: Commit** `feat: add Tauri desktop app with in-process server`

---

### Task 3: Manual verification, docs, changelog

**Files:**
- Modify: `README.md` (Desktop section), `CHANGELOG.md` (Unreleased)

- [ ] **Step 1: Verify on macOS with an isolated database**

Launch with `DATABASE_URL=sqlite:///tmp/bee-desktop-check/bee.sql OTEL_ENABLED=false desktop/target/release/beeteam-desktop`, without touching the user's `~/.beeteam/beeteam.sql`. Confirm:
- `lsof -nP -iTCP -sTCP:LISTEN -p <pid>` shows one `127.0.0.1:<port>` listener.
- `curl -s http://127.0.0.1:<port>/health` returns 200.
- The window shows the Bee Team UI.
- A second launch exits and focuses the first window.
- After quitting, the port is no longer listening and the process has exited.
- An invalid `DATABASE_DRIVER=bogus` produces the error dialog and exits.

- [ ] **Step 2: README.** Document prerequisites (Rust, Node, Xcode CLT) and the build/run command (`node scripts/build-desktop.mjs [--run]`). List these `~/.beeteam/desktop.env` keys: `BEE_SESSION_INSTALLATION_ID`, `BEE_CODEX_EXECUTABLE` (absolute native path), and optional `DATABASE_URL`. State that process environment wins, that the default database is `~/.beeteam/beeteam.sql`, and that the desktop app and CLI server must not run simultaneously with the same database and installation ID.

- [ ] **Step 3: CHANGELOG.** Under Unreleased, add: "Added an experimental macOS desktop app (Tauri) that runs the Bee Team server in-process and opens the embedded UI in a native window."

- [ ] **Step 4: Commit** `docs: document desktop app`
