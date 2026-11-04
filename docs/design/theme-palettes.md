# Theme palette provenance

Verified 2026-11-04. `theme-sources.json` stores the exact source values, product/surface, version, URL and asset hashes. These presets map source colors to Bee Team roles; they do not reproduce another product UI. Geometry, fonts, motion, API data, status colors, destructive colors and charts remain Bee Team's. The user explicitly authorized neutral Default colors for roles with no source equivalent (Leader comment01a1a81b-f026-7603-9111-0f73f0ece0f4).

## Default
The existing `index.css` light/dark tokens are unchanged. No palette selector overrides apply. Existing `beeteam.theme` remains the light/dark/system preference; an absent/invalid `beeteam.palette` means Default. Separate keys preserve existing installations without a destructive migration.

## Codex
Official Appearance preset documented at https://learn.chatgpt.com/docs/reference/settings (redirect from developers.openai.com/codex/app/settings): light background#FFFFFF/foreground#0D0D0D/accent#0285FF; dark#181818/#FFFFFF/#339CFF. This is a documentation snapshot, not a claim that all Codex releases or custom themes use these values. Installed desktop26.1029.7803.0 ASAR contains dynamic color generation (`webview/assets/async/496175.cf5ad221c1.js`); onboarding/checkout styles are different scopes and were not substituted.

Background/foreground map directly, inverse primary button uses ink/surface, accent maps to focus rings. Other surfaces retain Default as an explicit adaptation. Accent is not used as small body text on white, avoiding a contrast loss.

## Claude Code
Official https://claude.com/download and https://support.claude.com/en/articles/14554922-claude-code-user-faq identify Code as a tab in Claude Desktop. Downloaded the official Windows MSIX via the documented deployment URL and inspected its archive only. No installation, execution, login or private conversations. Desktop package version4.16336.0, main-window asset `.vite/renderer/main_window/assets/MainWindowPage-CuBboJr_.css`, `:root` and `.darkTheme` HSL declarations. These are the host window's tokens, not a claim that every Code-specific embedded surface is identical.

Mapping: background=bg-100; card/popover=bg-000; sidebar/secondary/muted=bg-200; hover=bg-300; foreground=text-000; muted foreground=text-200 (rather than lower contrast text-400); primary inverse=text-000/bg-100; focus=accent-000. Borders use source border-100 with Bee Team alpha0.2, input0.3: explicitly adapted opacity. HSL channels retain source precision. The warm neutral colors are source-derived, not an invented brand palette.

CLI2.1.318 tables were also inspected but are not applied to this Desktop-based preset. Its `background` token is cyan and is not terminal canvas. Official https://code.claude.com/docs/en/terminal-config confirms terminal background inheritance.

## Copilot
Exact built-in `github-light`/`github-dark` ANSI palette from official npm `@github/copilot@0.0.418`, `package/index.js`, objects MCr/LCr and semantic mapper HCr. This is deliberately version-pinned evidence, **not the latest1.0.105 palette**. The current1.0.105 native distribution was inspected but did not expose a readable token table; current docs only establish `theme=github`, not its RGB values.

Mapping: text=light black/dark whiteBright; muted=light blackBright/dark white; primary/brand=magenta; focus=blue. Primary contrast pair=light whiteBright/dark black. Surfaces and borders remain the neutral Default because HCr's backgroundPrimary/backgroundSecondary/textPrimary are undefined/inherited. No terminal canvas or GitHub marketing color is presented as an exact CLI color. Official reference: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference.

## Validation
State tests cover legacy preference, independent preset/mode, reload, storage events, invalid values and denied storage. UI tests cover independent controls. Visual QA must cover all4 presets,2 modes, desktop/mobile, EN/PT and unchanged Default. Verify readable text/primary button contrast and keyboard focus; do not replace semantic status colors to match branding.

Observed QA:32/32 combinations passed, including real API reads, UI selection/reload, unchanged mode, restoration of original Default tokens and the listed text contrast pairs. Evidence is in `.local/qa/theme-presets/evidence.json` with screenshots. API writes and SSE were blocked in this harness; the reconnect banner is a harness limitation. This does not assert full WCAG conformance or identical native-app rendering.
