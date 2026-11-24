# Internal Creation Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Use internal guidance functions instead of exposed creation skills.
**Architecture:** Read-only DTO/service with thin HTTP/MCP adapters, current schema-derived fields. Built-in agent rules select guidance and existing create operations.
**Tech Stack:** Rust/Axum/MCP/serde and bundled Markdown.
**Spec:** docs/superpowers/specs/2026-11-24-internal-creation-guidance.md

## Global Constraints
- Route -> DTO -> service, no direct DB/files in adapters; no mutation in guidance.
- Only four creation targets; unknown/extra parameters rejected consistently.
- Existing validation, access, role coordination and idempotency preserved.
- No global skill removal or custom profile rewriting.

## Review Focus
- Returned contracts match current OpenAPI required fields and relation semantics.
- New and resumed native conversations receive internal routing guidance.
- Existing seeded guide instructions do not override new creation path.
- Team/agent creation does not implicitly start execution or duplicate identities.
- No creation-only skills exist; remove dependency without deleting coordination skills.

## Task1: Guidance API/tool
- [x] Implement typed DTO/service and read-only HTTP/MCP tool.
- [x] Test all targets, invalid inputs, no side effects and parity; regenerate catalog.

## Task2: Runtime routing and docs
- [x] Replace creation skill recommendations with internal guidance in managed prompts/seed and pertinent bundled first-party references.
- [x] Test new/resumed roles, preserve custom profile text and non-creation coordination.
- [x] Update README and provenance as needed.

## Task3: Integration
- [x] Independent review, cargo build/test isolated DB, catalog validation and local runtime smoke.
- [x] Commit only task changes and push current branch (user authorized).
