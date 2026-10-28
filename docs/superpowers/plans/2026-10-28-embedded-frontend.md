# Single-binary frontend delivery

Authorized: embed compiled UI beside HTTP/MCP, retain separate Vite development,
no active service restart, data changes or publication.

Design: optional embedded-ui Cargo feature; repository owns embedded bytes,
service retrieves packaged assets, routes select known SPA paths and handle MIME/cache/HEAD. Runtime
BEE_FRONTEND_MODE=embedded|disabled defaults to embedded when compiled in.
API/MCP/docs and absent assets never fall through to HTML. API-only builds
reject an explicit embedded mode.

Build: npm ci plus forced real same-origin API build, source/output SHA-256
manifest, locked Cargo release build. Cargo rejects stale/missing output.
Node and dist are build-only inputs. No runtime filesystem asset fallback.

- [x] Red tests for deep links, missing/reserved paths, MIME/cache/HEAD.
- [x] Build pipeline and repository/service/route implementation.
- [x] Mode configuration and documentation.
- [x] Build/test, artifact independence check and local commit.

Evidence: docs/embedded-frontend-verification.md. Local commit only; no active runtime changed.
