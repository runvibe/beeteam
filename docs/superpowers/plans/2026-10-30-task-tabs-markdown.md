# Task tabs and Markdown

Approved by user through coordination on 2026-10-30. Implement in the existing frontend worktree; push this branch, integration and main merge remain with coordination. No product data writes or service restarts. Bee Team actor exception remains authorized; do not impersonate Demo agents.

Design read: compact task navigation for daily Bee Team work, restrained neutral product language using existing Radix/shadcn, Tailwind and Lucide. DESIGN_VARIANCE 3, MOTION_INTENSITY 2, VISUAL_DENSITY 7. Apply design-taste-frontend contextually to this product UI.

1. Replace mobile select with a single horizontal text tablist. Preserve labels and URL values; manual Radix activation, 44px targets, reserved overflow controls, minimal horizontal reveal on selection/focus. Resize observes actual sticky height for dependent scroll padding. Preserve page scroll, filters, state and overlay layers.
2. Audit all task content fields. Use shared safe GFM Markdown for descriptive prose, including overview, execution summaries, pending items, attachment descriptions, block reason and plan change summaries. Preserve plain structured labels, titles, identifiers, URLs and event JSON. No storage/API changes.
3. Test keyboard/manual activation, overflow/reveal/stable rerender, Markdown semantics and safety. Run full frontend suite/build, cargo build and cargo tests; record infrastructure limitations. Browser QA on 320/390/768/desktop and zoom, sticky filters/overlays, first/last tabs and reduced motion.
4. Fresh code review, fixes, README, commits and branch push. Coordinator owns merge.

Pre-flight: tabs affect sticky height consumed by conversation filters and plan navigation. Markdown may change content height; preserve existing resize-aware anchors. No persistence dependencies.

## Progress

- Base: 97e7963. Audit confirms specification, plan content and comments already use Markdown; additional fields listed above still use plain text. Deliverables contain only label and URL, not a description field; keep their structured labels literal.

- Implementation: single tablist with manual Radix activation; local horizontal reveal; stable arrow slots; measured 70px sticky height in browser. Markdown coverage recorded in frontend/README.md. Existing labels and URL keys preserved.
- Verification: initial new tab/Markdown tests failed for missing functionality; final frontend suite passed 212 tests across 64 files. Frontend production build passed (existing >500kB bundle warning). `cargo build --locked --features mcp -j 1` and `cargo test --locked --features mcp --lib -j 1` passed (20 library tests). Full PostgreSQL integration was not rerun because isolated infrastructure was unavailable in this session; no product database used.
- Fresh review: tabs_markdown_review found one P2, code/quote contrast inside red blocked alert. Fixed with paired surface text tokens and inherited quote contrast; light/dark regression tests pass. No other actionable findings.
- Browser QA: existing 5176 preview at 320, 390, 768, 1440px; no global horizontal overflow; 44px targets, weight500 in both active/inactive tabs. End changes focus only, Enter activates; Home+Space activates overview. Chevron moves strip without changing active tab. Existing historical summaries render Markdown. At desktop after scroll, nav72..142 and conversation filters142..186; menu visible above content.
- QA limitation: native browser automation stopped when it could not confidently identify the Windows window URL while attempting real 200% zoom. No further browser automation performed. Real zoom200%, physical touch swipe and visual light-theme verification remain pending; unit coverage verifies theme code/quote colors and navigation adds no motion. Temporary browser viewport was 1440x900 at interruption. Do not claim these pending checks passed.
- Ruling: keep structured deliverable labels and Timeline JSON literal, as explicitly requested; Deliverable has no description field. No new content fields, backend changes or product data writes.
