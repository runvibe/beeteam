# Task overview insights implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the fully authorized task overview using complete, source-backed API aggregates.

**Architecture:** A task overview endpoint owns snapshot aggregation and provenance. Focused frontend modules render charts, attention/current synthesis, and recent artifacts/activity. Subtask chart links activate actual server-side filters in the existing infinite list.

**Tech Stack:** Existing React, TanStack Query, Radix/shadcn, Tailwind tokens, Lucide; semantic HTML and SVG for charts, no new visualization dependency.

**Spec:** Human authorization relayed by coordinator on 2026-10-30: status distribution of direct children, separate blocked dimension, registered progress history, completed/remaining children by assignee, recorded attention/summary/next step, recent deliverables/files/activity. Existing light/dark theme; no fabricated health/productivity/forecast metrics.

## Global constraints

- No product-data writes, demo creation, service restart or main merge.
- Direct children only; counts aggregate complete database scope, not first pages.
- Unknown author/time/next step remain explicitly unavailable, never derived from unrelated task timestamps.
- Progress records and child completion are distinct quantities. Blocked is overlapping state, never another additive status bucket.
- Safe Markdown, keyboard access, text alternatives, responsive layout, reduced motion.
- Preserve description and progress note; bounded latest feeds disclose scope.

## Review focus

- Empty/single-point history: no fabricated line, percentage or date.
- Status from different boards: filter by real status identity, never label alone.
- Deleted/archived assignees or unknown actors: retain truthful identifier/fallback.
- Subtask filter URLs and switching task: no stale counts or unrelated children.
- Recent historical pending items are not presented as current unresolved work without a reliable current source.

## Tasks

- [x] Agree backend DTO, data coverage, missing provenance and list filter semantics.
- [x] Add typed HTTP/mock adapters and failing contract/render/filter tests.
- [x] Implement status/assignee charts and registered progress SVG with text alternative.
- [x] Implement recorded attention, current summary metadata, artifacts and recent activity.
- [x] Wire graph clicks to actual subtask filters; maintain infinite pagination/cancellation.
- [x] Review, verify tests/build, document runtime limits, commit/push own branch.
- [ ] Validate real charts in desktop/mobile preview after backend activation.

## Delivery evidence and runtime boundary

- Frontend: 242 tests in 70 files passed; TypeScript and production build passed. Existing bundle-size warning remains (approximately 896 kB main JS).
- Rust: cargo build --locked --features mcp -j 1 and cargo test --locked --features mcp --lib -j 1 passed (20 unit tests). PostgreSQL integration tests were not run here; backend validation belongs to the separate backend branch.
- OpenAPI snapshot synchronized from the backend working tree with backend owner's explicit agreement; generated TaskOverview schema constrains the HTTP adapter response.
- Review fixed latest explicit summary provenance, cross-board status labels, keyboard focus after drilldown, and responsive chart label sizing.
- Existing API at port 59865 still returns HTTP 404 for the overview endpoint at final verification. Error fallback preserves task prose. Real chart desktop/mobile, light/dark and artifact-download acceptance remains pending backend integration and operator activation. No service was restarted, product data created, or main branch merged.
- Next-step and decision UI only renders supplied records; current backend contract provides null/empty values. Historical progress gaps remain explicit.
