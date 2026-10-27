> Tema substituido por novo CSS em 27/10: tokens sem neutralizacao, branco original e radius .625rem. Decisoes anteriores abaixo sao historicas; README descreve estado atual.

# Monochrome operations UI — Implementation Plan

> Use superpowers:executing-plans in this session; native implementation and independent final review.

**Goal:** Apply the user-authorized compact monochrome redesign without changing domain behavior.
**Architecture:** Existing React features keep API/cache ownership. Small shared breadcrumb/filter/avatar components handle presentation. Semantic tokens and layout CSS define appearance. Radix dialogs retain focus/modal semantics while presenting as side panels.
**Tech Stack:** React/Vite/shadcn/Zustand/TanStack Query; existing in-memory adapter.
**Spec:** Visual audit at C:/Users/phili/.codex/visualizations/2026/10/27/01a17e2c-4f16-78a0-8f6c-a1309651a0de/auditoria-proposta.md, approved for implementation via parent chat 27/10/2026.

## Constraints

Only frontend files; preserve unrelated root changes. No backend/auth/push/merge/deploy. All existing records, filters, pagination, autonomy rules, editing and recursive cross-board navigation remain. Theme persistence remains. No file exceeds 1000 lines. CSS reference supplies the neutral palette, installed Inter/Playfair Display/JetBrains Mono fonts, .29rem spacing and shadows. Intentional differences: pure-white surfaces become .985, chroma is removed, sidebar primary is neutral, negative radii are clamped. Compact layout remains authorized.

## Review focus

- Breadcrumb follows actual task ancestry across boards; cycle/unavailable ancestors cannot hang UI.
- Closing detail keeps board filters and restores focus when opener remains mounted.
- Collapsed/mobile navigation retains accessible names; no clipped theme control.
- Semantic states remain readable without colors or decorative badges.
- Form values and version behavior unchanged; configuration reachable in compact layouts.

## 1. Palette and navigation

- [x] Add regression test for contextual task path/closing with retained filter; run RED.
- [x] Add breadcrumb module with asynchronous ancestry query and cycle guard; wire App/detail header.
- [x] Adapt index.css and prepaint background; grayscale tokens, valid radii, visible focus/input boundaries.
- [x] Compact sidebar/topbar; accessible labels retained even when icons only.

## 2. Feature presentation

- [x] Reuse AgentAvatar in cards; extract from agents feature into small component.
- [x] Remove decorative title labels and card description duplication; preserve details and semantic metadata as text.
- [x] Shared filter disclosure for narrow screens; reset action uses existing filter setters.
- [x] Detail dialogs become side panels, full screen on narrow viewports, with independent scroll and stable close control.
- [x] Compact records/tabs/forms; time detail puts composition before metadata editor without dropping fields.
- [x] Run frontend tests/typecheck/build; inspect desktop/light/dark/mobile and recursive detail through browser.

## 3. Delivery

- [x] Independent review; fix actionable regressions.
- [x] Run cargo build/test; record infrastructure failures separately.
- [x] Update README/PROGRESS and audit decisions; save final screenshots.
- [x] Commit frontend locally and report preview, checks and commit to parent.
