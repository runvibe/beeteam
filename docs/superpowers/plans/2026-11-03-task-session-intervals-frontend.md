# Task session intervals frontend implementation plan

Goal: present explicit task interval consumption, coverage and lifecycle without inferring historical boundaries.
Architecture: generated backend DTOs at the API boundary; focused read-only overview, timeline and interval detail components. Reuse Radix point popovers and immutable summary lookup. Server aggregates remain authoritative across pagination.
Stack: React, TypeScript, Radix, existing theme tokens, Vitest.
Spec: approved docs/task-session-intervals-spec.md in the principal checkout.

- [x] Independent foundations: exact observed duration formatter and reusable summary lookup; tests for missing/zero/large duration and UUID pagination.
- [x] Sync final backend read/write schemas and typed API adapters; preserve legacy absent execution tracking. Validate schemas and HTTP paths.
- [x] Overview: tokens by valid task intervals, partial coverage/open/incomplete counts, separate summed observed and elapsed durations; no session/task totals conflation.
- [x] Accessible timeline of start/checkpoint/pause/resume/finish with explicit immutable summary references, historical status/actor, observations/model/source, boundary/delta detail and summary access. Empty plot remains visible.
- [x] Regression tests for zero/large/missing, checkpoints without closing, resumed intervals, partial pages, errors, mouse/keyboard/touch. Fixture data stays isolated in tests.
- [x] Frontend tests/build, cargo build and library tests; desktop/mobile UI verification where available without touching product data/runtime. README, commit/push and coordinator handoff.

Decisions: preserve existing visual system; no new dependencies. Wait for backend DTO shape before API integration. No fabricated tracking for legacy summaries. No aggregate arithmetic over loaded rows or temporal joins to progress events. No production writes or active service restarts.

Validation ledger: focused frontend tests/build and cargo build passed. Desktop1440/mobile390 isolated fixtures verified through CUA; narrow numeric overlap corrected with responsive grid. Mouse/keyboard/touch covered in tests. Independent review found missing execution agent on paused finish; separate event.agentId presentation and regression test added. No product data/runtime changed. The temporary5181 fixture server and its two entry files were removed. Runtime/API integration remains coordinator responsibility after backend rollout.

Final validation: npm test -- --maxWorkers=2 passed 298 tests in 83 files; frontend production build passed (existing chunk warning); cargo build --locked --features mcp -j 1 and cargo test --locked --features mcp --lib -j 1 passed (20 library tests). OpenAPI SHA256 matches backend worktree at delivery.
