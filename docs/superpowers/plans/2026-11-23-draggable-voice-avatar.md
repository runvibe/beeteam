# Draggable Voice Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transparent, theme-neutral, freely draggable detached voice controls.
**Architecture:** Separate detached presentation/drag geometry from app-lifetime voice owner; preserve native call routing and lifetime.
**Tech Stack:** React, TypeScript, CSS, Vitest.
**Spec:** docs/superpowers/specs/2026-11-23-draggable-voice-avatar.md

## Global Constraints
- No card background/title or normal visible button labels; accessible labels/tooltips required.
- Drag on avatar only, no magnets; viewport bounds and responsive resizing.
- All voice visuals neutral in both themes, including hover/mute.
- No interruption to call, transcript or independent chat input.

## Review Focus
- Buttons must not move the avatar or trigger unintended controls after drag.
- Pointer cancellation/Escape restores position.
- Browser window resizing keeps controls reachable.
- Inline/detached transitions preserve call and position.
- Error persistence/dismissal remains accessible without normal card.

## Task 1: Presentation and drag
- [x] Implement focused detached component, shared theme-neutral voice styles, icon actions and pointer drag.
- [x] Add meaningful interaction tests and run focused checks/build.
- [x] Update README and CHANGELOG.

## Task 2: Verification
- [x] Independent review and browser checks for controls, free drag, cancellation, viewport bounds and both themes.
- [x] Required cargo build/test with isolated PostgreSQL, final frontend checks.
- [x] Commit only task files.
