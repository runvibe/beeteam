# Standalone startup defaults — 2026-11-02

The distribution starts with SQLite at ~/.beeteam/beeteam.sql, host 127.0.0.1,
port 59865, MCP enabled, telemetry disabled, and embedded frontend enabled.
Configuration resolves home without writing; the SQLite adapter creates missing
parent directories only while opening persistence. Existing data is not moved,
converted or reset. A matching explicit DATABASE_URL remains unchanged; absent
an explicit driver, PostgreSQL URL schemes retain PostgreSQL selection. An
explicit non-SQLite driver still requires its URL. Existing .env overrides remain.

Cargo defaults include mcp. The distribution script explicitly includes both
mcp and embedded-ui and verifies the frontend source/build manifest. A plain
Cargo development build does not embed the UI. --no-default-features supports
an API-only compile; MCP_ENABLED=false and BEE_FRONTEND_MODE=disabled disable
those routes in the full executable. Environment flags cannot enable missing
compiled features.

## Verification

- Default-feature unit tests: 24 passed, including no app envvars with a temporary
  USERPROFILE/HOME, exact home filename and URL encoding, no config filesystem
  writes, matching/mismatched database overrides, MCP/telemetry and host/port.
- SQLite persistence: 9 passed, including nested directory creation and reopen
  preserving an existing record. All databases are isolated temporary fixtures.
- --no-default-features unit tests: 24 passed, including absence of MCP endpoint.
- node scripts/build-distribution.mjs passed with an isolated target directory.
- The release executable was started only in a temporary test home/cwd with an
  empty .env, a free loopback port and app environment overrides removed. UI
  /boards and MCP tools/list returned 200; the exact default SQLite file appeared
  in the temporary home. On a second isolated launch, UI/MCP explicit disabled
  returned 404 while health stayed 200. Only these owned test processes stopped.
- The active application and real home database were never opened or modified.

The debug embedded-test compiler exited 0xffffffff without diagnostic. A concurrent
API-only debug build then reported a missing dependency-info directory; both
occurred in the shared target/debug output. Feature checks are repeated in the
isolated distribution release target below. No product process was restarted to
validate packaging.

Final isolated release verification passed: 24 unit tests with mcp+embedded-ui
and all 4 embedded frontend tests (deep links/reserved routes, MIME/ETag/cache/HEAD,
explicit UI disable and private manifest). Command:

```text
BEE_FRONTEND_DIST=<workspace>/.local/distribution/frontend/dist
CARGO_TARGET_DIR=<workspace>/.local/distribution/defaults-target
cargo test --locked --release --features embedded-ui --lib --test embedded_frontend -j 1
```

The standalone distribution was preserved at .local/distribution/beeteam-defaults.exe
with SHA-256 6077ff781c113d3ae709f3c4663638ee7383289d8e79e592a0282fe423a0023b.
The separate API-only debug executable build was not claimed successful after its
shared-output failure; its no-default-features unit compilation and all 24 tests
passed, and explicit API-only runtime on the full distribution passed. PostgreSQL
connection tests were not run; URL/driver compatibility is covered by config tests.
