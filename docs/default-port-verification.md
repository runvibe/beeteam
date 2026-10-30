# Default port 59865 verification

The application now defaults to `127.0.0.1:59865`. Explicit `APP_PORT` remains
supported and feeds the MCP endpoint. The local launcher uses the same value
for startup, port checks and readiness URLs; bootstrap follows APP_PORT too.
Vite defaults to that API port and preserves explicit BEE_API_TARGET.
Current env examples, Docker EXPOSE and OpenAPI server examples are aligned;
historical validation records and bundled skill snapshots remain historical.

No origins were added to runtime defaults: transfer origins remain explicitly
configured (empty by default); launcher CORS defaults remain the Vite loopback
origins and now preserve explicit CORS/MCP origin settings.

## Validation

- A new AppConfig regression first failed with 8080, then passed for 59865 and
  explicit 23456, including listen address and derived MCP URL.
- Local PowerShell HTTP configuration: default, override, invalid values passed.
- Python bootstrap tests: 3 passed, including default/override without HTTP writes.
- Actual Vite configuration loaded with isolated env: default and override passed.
- API-only cargo build and full MCP-enabled suite: 87 passed, zero failures.
- Frontend suite: 97 passed on final rerun. Initial concurrent run timed out in
  App.test.tsx, `keeps filtered board context while the task breadcrumb follows
  cross-board ancestry` (5s); 96 others passed. No test timeout was changed.
- MCP catalog regenerated with the required example; output unchanged.
- Release build via the distribution script completed in a separate Cargo target
  directory. Full Rust suite with mcp,embedded-ui: 91 passed, zero failures.

## Artifact and active process

Build command (PowerShell):

```powershell
$env:CARGO_TARGET_DIR='.local/distribution/port-target'
node scripts/build-distribution.mjs
```

Artifact: `.local/distribution/port-target/release/beeteam.exe`.
Size: 39953920 bytes. SHA-256: `5d4b815895925d268394006a6dfdc4a4fc954d07c6b66c2f2671945e733af344`.

The previous target/release executable remains unchanged (SHA-256
c213280acda7247f6cfef7b41a6e78f34ae83040e3889c209deb83111275c1b9).
PID 101568 still listens on 127.0.0.1:59865. No process restart, product database
write, personal Codex configuration change, push, merge or deployment was made.
The new executable was built, not activated; runtime-port behavior is covered by
configuration and embedded-handler tests rather than a second live server.
