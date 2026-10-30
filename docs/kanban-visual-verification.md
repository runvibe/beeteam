# Kanban visual adjustment verification

Blocked tasks retain the lock badge and now use a destructive-color tint and
left accent. The color mixes with the current theme card background. The board
uses the available main-content height and stretches all columns to the same
bottom; long content and narrow screens remain scrollable.

Validation used temporary Vite mock preview and headless Edge, closed after
inspection. No product API writes or live server changes occurred.

- 1440 x 1000, light and dark: all five column bottoms at 954px, exactly the
  board content bottom; main content reaches the 1000px viewport bottom.
- 390 x 844: all five column bottoms match the board content bottom; longer
  content extends the page naturally without clipping.
- Blocked and normal card computed backgrounds differ in all three scenarios.
- Screenshot: `.local/card-layout.png` (isolated fixture, not product data).
- The new blocked-card regression failed before the change, then the complete
  frontend suite passed: 98 tests. Production frontend build passed.
- Cargo build and the complete MCP-enabled Rust suite passed: 87 tests, using
  only the isolated PostgreSQL test database.

Single-binary distribution build passed. Separate artifact: `.local/distribution/artifacts/beeteam-kanban-visual.exe`.
SHA-256: `9bb74fb18085396a2e09df46ee7be5486df05a0d4507ca88bf25ec26236be385`. The new binary was not activated; the existing service
remains unchanged.
