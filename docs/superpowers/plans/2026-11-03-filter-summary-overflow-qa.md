# Filter summary width regression

Scope: retain all filter tags, interaction and docking while fixing mobile horizontal overflow.

Cause: `.filter-summary-list` used `right: -4px` and `min-width: calc(100% + 8px)`.
Even the hidden, empty list extended the document beyond its right edge. Aligning its
right edge to zero and minimum width to 100% keeps the existing internal padding.

## Manual regression procedure

Use an isolated in-memory App fixture with enough attachment rows to scroll. Activate
filename `relatorio-com-nome-longo`, MIME `application/pdf` and include-removed filters.
Never seed or reset the product database for this test.

1. At 390 x 844, inspect collapsed tags, expand by keyboard and confirm every tag is readable.
2. Measure document clientWidth and scrollWidth in both states: they must match.
3. Remove one tag, verify URL and remaining labels, then scroll until the mobile filter dock appears.
4. Confirm docked tags remain within the viewport and the page still has no horizontal overflow.
5. Clear all filters; confirm the summary disappears and document widths still match.
6. Repeat expanded/keyboard and scrolled states on desktop; detail panel widths must match.

## Observed result

- Before: document clientWidth 380, scrollWidth 384 with active filter summary.
- After: mobile document 380/380, collapsed, expanded, after individual removal, docked and cleared.
- Docked expanded summary/list right edge 366px; all tags remained visible.
- Desktop detail panel 1494/1494, summary/list right edges both 1558px.
- Existing filter-summary/filter-bar/filter-tooltip-layer/task-filter-layout/attachment-records tests: 15 passed.
- Frontend build, cargo build with mcp and 33 Rust library tests passed.

The patch changes only two sizing declarations; no overflow clipping or filter state changes.
