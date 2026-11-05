# Develop and verify a change

Use Rust 1.94+, Cargo, native build tools, Node 22.20+ and npm. Run commands from the repository root unless indicated. [Agent and contribution conventions](../../AGENTS.md) describe module boundaries, tests and review.

```sh
cargo build --locked
cargo run --locked
```

The development server exposes API and MCP on loopback. In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Run `npm test`, `npm run audit:i18n` and `npm run build` there before reviewing frontend changes. Keep technical identifiers, URLs and user-authored Markdown stable across locales.

## Backend tests

Use a disposable PostgreSQL 18+ instance. The test user must be able to create databases. Configure `BEE_TEST_DATABASE_URL` to point only at this test instance. With `BEE_TEST_DRIVER=sqlite`, shared HTTP/MCP tests use temporary SQLite files. PostgreSQL-specific tests still need the isolated PostgreSQL URL. Set `OTEL_ENABLED=false` if no collector is running. Run:

```sh
cargo test --locked
```

For PostgreSQL coverage of the shared tests, unset `BEE_TEST_DRIVER` and rerun. Test both drivers for persistence changes.

## Contracts and packaging

Edit the owning [Kanban](../kanban-openapi.yaml) or [agent/team](../ra-openapi.yaml) contract alongside DTO changes. Use `cargo run --locked --features mcp --example mcp_catalog` to emit the MCP catalog and update [the generated JSON](../mcp-catalog.json) from its output. In the frontend use `npm run generate:types` when regenerating client types. Review generated diffs.

Run `node scripts/build-distribution.mjs` to build the native executable with same-checkout assets. With Python 3.11+ package the result and run the archive smoke against temporary storage as described in [native distribution candidates](../release-distribution.md). The workflow uploads candidate artifacts for review. Publication and site promotion are separate operations.
