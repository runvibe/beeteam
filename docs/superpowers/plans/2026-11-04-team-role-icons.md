# Team role icons

Authorized specification: Bee Team task `01a1a854-fd75-79c0-8e38-8b7223e69cfb`, comment `01a1a854-fef4-7dd1-b72f-85e4cadff9f6`. Base `fe65842`. Existing Collaborator owns execution and reporting. No product resets or service restarts. Leader integrates the delivered commits.

## Prior independent delivery
Harnesses used buttons in task Overview must have transparent backgrounds in every palette/mode, preserving symbols, tooltips and focus. Deliver first in a separate commit.

### Task 1: Configurable team role icons

Implement the full feature in cohesive modules, preserving repository architecture and all membership cardinalities. Reuse existing shadcn/Radix/Tailwind/Lucide UI.

- Define a closed shared catalog of stable IDs, English names, safe Unicode prefixes and corresponding monochrome SVGs. No arbitrary SVG or control characters as input. Use official existing Lucide paths where possible; avoid hand-drawing icons. Catalog representations must agree in UI and HTTP/MCP.
- Add two configurable fields for team leader and collaborator icons, with backward-compatible defaults for legacy records. Recommend `leaderIconId` and `collaboratorIconId`, resolved `roleIcons` in reads, plus discoverable catalog endpoint/tool. Choose exact contract after reading existing patterns and report it before downstream assumptions. Existing defaults may be crown/bee to preserve chat conventions, but respect existing UI semantics and document migration.
- HTTP and MCP share DTO validation and service logic, store only IDs, return resolved representations. Preserve SQLite/PostgreSQL generic persistence and portable-transfer behavior; no reset/migration of user content unless strictly required.
- Team settings: two accessible EN/PT selectors with preview, autosave/reload. Team/role contexts use configured icons; standalone agent avatar remains identity. Cover lists, team member role, agent memberships and related context. Do not change unrelated task status/autonomy symbols.
- Skills and MCP bundled resources in English: resolve actual team and role before setting own chat prefix, use selected Unicode idempotently without destroying title. Read back when supported; report unavailable rename/readback honestly. Never rename other existing chats or bulk-rename. Remove fixed bee/crown requirements where incompatible; define honest fallback for no team/unavailable lookup. Update source skills and bundled provenance, not installed global copies without separate instruction.
- Test invalid IDs, independent roles, default/legacy records, HTTP/MCP create/update/read parity, catalog safety, selectors/autosave/reload, role rendering, prefix guidance and skill provenance. Regenerate OpenAPI frontend types and MCP catalog. Run cargo build/test with isolated SQLite; PostgreSQL-specific tests require isolated PG18, never product DB. Run frontend tests/build/i18n audit.
- README, focused modules under1000 lines, meaningful commits. No unrelated changes; no pushing/merging by implementer. Report all commands and known limitations.

## Acceptance
Independent transparency commit delivered first. Feature delivered only after review and tests, with real evidence distinguishing code, runtime and human acceptance. Keep status under review until Leader acceptance.
