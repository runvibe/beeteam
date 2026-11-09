# Long plan scrolling with the chat workspace

Manual browser regression scenario, verified on the local review app on 2026-11-09.

1. Open a task's Plans tab with a plan longer than the desktop viewport (tested at 1067px height).
2. Inspect the detail-primary scrolling region and its workspace ancestors.
3. Scroll over the plan body to the final section and revision history.

Before: the app shell was 1067px high with overflow hidden, but chat-workspace and main-shell grew to 4893px. The inner detail-primary had equal clientHeight and scrollHeight (4837px), so it could not scroll.

Fix: let chat-workspace shrink with min-height: 0 and stretch its main-shell child to the available grid height. Do not remove the detail page's existing independent scrollers.

After: workspace and main-shell were 1067px; detail-primary clientHeight was 1011px versus scrollHeight 4839px. Actual browser wheel input reached scrollTop 3827.78px, the bottom of the plan. No data or plan text changed.

This is a real browser layout check; jsdom component tests do not establish scroll geometry.
