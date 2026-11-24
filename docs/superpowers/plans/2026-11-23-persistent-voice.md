# Persistent Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep one voice call alive across navigation while typing independently elsewhere.
**Architecture:** Extract call owner and call-scoped context from ManagedVoiceChat; globally render detached controls; scoped view bindings handle selection only while matching the origin.
**Tech Stack:** React, Zustand, TypeScript, Vitest, existing native Codex voice.
**Spec:** docs/superpowers/specs/2026-11-23-persistent-voice.md

## Global Constraints
- No backend changes unless required; no product database tests.
- Source files under 1000 lines, modular ownership, current access/idempotency semantics.
- Preserve drafts, transcript persistence, microphone release and late-event guards.

## Review Focus
- Switching while voice startup or send is pending must not select origin unexpectedly.
- Old stop/failure callback must not end replacement call.
- Permissions and request agent/team stay bound to original chat.
- Detached UI remains available when chat subtree unmounts or Home opens.
- Origin text send association and refreshed transcripts remain consistent.

## Task 1: Call lifetime and UI
- [x] Add failing tests for navigating/typing another session, return, replacement and stale callbacks.
- [x] Extract voice ownership and fixed call context; refactor ManagedVoiceChat and ManagedAgentChat integration, add global detached avatar and translated labels.
- [x] Run focused tests, fix obsolete stop-on-navigation tests; preserve original first text adoption, uncertainty and access-mode checks.
- [x] Update README/CHANGELOG.

## Task 2: Validation and review
- [x] Review complete diff independently for cross-session routing and resource leaks.
- [x] Browser test both sessions using mocked native transport; check detached controls, typing, replacement and return.
- [x] Run frontend build/tests and required cargo build/test against isolated PostgreSQL.
- [x] Commit only task files.
