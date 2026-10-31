# Task filters and participants

Implemented in the frontend branch under the human's technical-chat exception.
The coordinator owns main integration and runtime activation.

## Accepted behavior

- Desktop tabs and filters share one sticky wrapper; tabs align left, filters right.
- Mobile filters initially follow tabs. Active filters dock below the sidebar logo when their origin leaves the viewport. Menus, search and tags expand right. Controls retain their DOM and state; a focused/open interaction keeps the dock visible while temporarily clearing the last filter.
- Participant options load every page of the exact-task participants endpoint, independently of comment search/window. No global-agent fallback or fabricated human identity.
- Conversation entry preserves scroll; the anchor measures the mobile sticky strip when its parent uses display:contents.
- Final human spacing correction: task-page padding zero at every breakpoint; desktop primary padding-right 8px, bottom 16px. Removed obsolete phantom grid column.

## Validation

- Full frontend suite: 221 tests / 65 files passed. Subsequent mock historical-assignment coverage and related regression suite: 11 tests / 4 files passed.
- Frontend production build passed; existing large-bundle warning remains.
- cargo build --locked --features mcp -j 1 passed.
- cargo test --locked --features mcp --lib -j 1: 20 passed. Full PostgreSQL integration suite was not run; isolated PostgreSQL is unavailable here.
- Browser preview 5176: mobile 390x844 dock, right popover, inline input position/focus inspected. Desktop 1440x900 final computed padding: wrapper0, primary right8/bottom16; scroller bottom900; tabs/filter right1122. No product writes or service restart.
- Review found a P2 focused input disappearing on last-filter removal; fixed by retaining dock while focused/open, with a regression assertion.

## Integration dependency

Backend branch commit d81b0f4ab70e85f030f8cb99e1d0073cae278f1a supplies GET /api/v1/tasks/{taskId}/participants. The active API had not been updated during this validation. Live participant loading remains to validate after coordinator activation; error/retry is implemented and unit-tested. Browser zoom 200% and physical mobile device acceptance remain unverified.
