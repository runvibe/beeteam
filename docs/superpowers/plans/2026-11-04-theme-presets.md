# Verified theme presets implementation plan

Goal: preserve Default and offer Codex, Claude Code and Copilot palettes independently of appearance mode.
Architecture: CSS role overrides selected by root data-palette; Zustand persists only local appearance, separate from API records. Existing components and design system remain.
Tech stack: React, Zustand, Radix, Tailwind, Vitest, Playwright.

- [x] Research official artifacts and record exact tokens/version/surface plus authorized adaptations in docs/design/theme-palettes.md.
- [x] Test legacy preference, independent palette, reload/storage events and denied storage; extend state/theme.ts.
- [x] Add Configurações palette/mode selectors and EN/PT strings without remounting content.
- [x] Verify synchronous theme-init and original Default preservation; test UI and contrast.
- [ ] Run frontend tests/build/audit, required Cargo checks, headless responsive QA; review and deliver commit/PR with limitations.

Design read: restrained functional product UI; preserve existing density, geometry and motion. No aesthetic overhaul. Exact-source colors mapped to existing web roles; base-neutral adaptation explicitly authorized. Claude uses Desktop host main-window tokens; Copilot source version pinned0.0.418, never called current1.0.105.

Validation:538 frontend tests passed with2 workers (initial unrestricted run had1 timeout; isolated rerun4/4 passed). Build and i18n audit passed. QA32 cases passed with persisted preset, unchanged mode, Default restoration and measured contrast>=4.5 for foreground/card/popover/primary/muted/sidebar pairs. Final title/transfer grouping validated by6 focused tests and refreshed32-case QA. Static independent review found no actionable defects. Cargo build passed; Cargo test result recorded in delivery.
