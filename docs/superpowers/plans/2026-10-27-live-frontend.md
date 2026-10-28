# Live frontend updates implementation plan

**Goal:** Refresh visible API-backed views after external writes without losing URL, focus, scroll or drafts.
**Architecture:** ApiProvider receives an SSE source for `/api/v1/changes`. Invalidate/reset events coalesce into authoritative query refreshes. Heartbeat every 15 seconds and a 45-second watchdog recover half-open proxy connections. Reconnect and visibility resume refetch snapshots. No entity replication or automatic navigation.
**Scope:** Existing UI, preserving sidebar/theme and operational data. Real writes restricted to isolated QA18083/PG55481 fixtures.

- [x] Confirm SSE contract with Backend.
- [x] Implement/test lifecycle, coalescing, reconnect, fallback polling, cleanup and visibility resume.
- [x] Preserve form identity/version baseline and cached data on background errors.
- [x] Test remote updates preserving URL/focus/draft and stale save conflicts.
- [x] Frontend 94 tests, build and lint passed (existing warnings). Reviewer found no concrete remaining issue.
- [x] cargo build and 14 unit tests passed. Integration suite blocked here by missing BEE_TEST_DATABASE_URL; no product database used.
- [x] Final isolated proxy reconnection evidence; ready for local commit.

Real QA already confirmed external board changes without reload, exact scroll/focus/URL preservation, unsaved draft preservation and rejected stale save. The initial static proxy restart exposed a half-open SSE stream; regression test reproduced the missing heartbeat behavior before the watchdog fix. The final restart exercise uses the same proxy with the fix.

Final QA: stopped API18083 for 65 seconds behind static Vite proxy5175. Disconnection notice appeared; draft, focus and URL remained intact. After restart, notice cleared and external board PATCH version5 appeared automatically (QA SSE - reconexão confirmada). Screenshots: live-watchdog-disconnected.png and live-reconnected-static.png in the task visualization directory. No production writes.
