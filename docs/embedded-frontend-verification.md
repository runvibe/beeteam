# Single-binary distribution verification

Implemented on top of portable export/import commit `5516204` in the backend
worktree. No product database changes, service restarts or publication.

## Build and runtime boundaries

`node scripts/build-distribution.mjs` runs a locked frontend install in an isolated
build directory, then produces `target/release/beeteam.exe` with `mcp,embedded-ui`.
Frontend sources and output files are hashed; Cargo rejects missing, stale or
modified output. The producer fixes `NODE_ENV=production`, real API mode and
same-origin `/api/v1`. The consumer validates those settings and embeds bytes
using `include_bytes!`. No runtime disk-assets loader or Node process exists.

`BEE_FRONTEND_MODE=disabled` preserves API-only behavior even in an embedded
executable. Without the Cargo feature, API-only is the default and requesting
embedded mode fails clearly. Existing Vite proxy/hot reload remains available.

## Evidence

- Initial routing tests failed with 404 for UI paths before implementation.
- Release build command completed, including `NODE_ENV=production` inherited by
  the parent process. `npm ci --include=dev` retained TypeScript/Vite.
- Rebuilding with inherited `NODE_ENV=development` produced an identical SHA-256
  manifest of source inputs and every output file; child builds remain production.
- `cargo build --locked --features mcp,embedded-ui` passed.
- Full `cargo test --locked --features mcp,embedded-ui`: **90 passed**, zero failed.
  Database integration used only the isolated PostgreSQL 18 test instance and
  temporary SQLite files from the existing suite.
- Frontend `npm test`: **97 passed**, zero failed. The production frontend build
  is part of the distribution command.
- Four embedded routing tests cover known deep links; API, configured overlapping
  MCP prefix, unknown routes and missing assets; JavaScript/CSS/font MIME; HTML
  revalidation, immutable asset caching, ETags, HEAD/304 and disabled mode.
- The compiled routing-test executable was copied into a separate directory with
  no frontend files; PATH contained only Windows System32. All four tests passed
  without Node/Vite on PATH or working-directory asset files.
- Relative `BEE_FRONTEND_DIST` paths were tested (initial generated-include failure reproduced, then fixed by resolving against the project root).
- Deliberately missing dist, tampered HTML and a stale source-hash manifest each
  caused the expected Cargo build failure. API-only build/test does not require
  a frontend dist, even with an absent build-only override. The full API-only
  MCP-enabled suite passed **86 tests**, zero failed.
- Independent read-only review found inherited NODE_ENV could omit build tools or
  produce a development bundle. Explicit dev dependency installation and fixed
  build environment resolved the finding; reconfirmation found no P1/P2 remaining.

Local logs: `backend-embedded-*.log` (ignored). Build artifacts remain under
`target/release` and `.local/distribution`; they are not committed.

## Local release artifact

Windows x64: `target/release/beeteam.exe`, 39953920 bytes.
SHA-256: `c213280acda7247f6cfef7b41a6e78f34ae83040e3889c209deb83111275c1b9`.

## Limits

This validates compilation, packaged handler behavior and in-process HTTP/MCP
integration. No active service was replaced and no browser visual inspection or
production runtime activation was performed. PostgreSQL/SQLite configuration and
data remain external to the executable. Repeatable dependency/source inputs are
provided; byte-identical Rust binaries across different OS/compiler toolchains
are not claimed.
