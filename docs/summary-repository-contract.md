# Structured work scope and commit declarations

Authorized implementation plan (2026-11-03): extend the existing JSON resource contracts and shared DTO/service validation; persist task scope and historical commit snapshots in the existing transactional resource payloads on SQLite/PostgreSQL. No schema migration or inferred backfill. Add focused atomicity, replay, compatibility and URL tests; verify existing attachment filters; regenerate MCP catalog, build and commit. Product data/runtime remain untouched.

## Task scope

Optional Task/CreateTask/PatchTask.workScope = {status, projects, repositories}. Status: identified|to_identify|not_applicable. Projects: {key,name,rootPath}; absolute rootPath is literal checkout metadata, never opened/executed. Repositories: {key,name,remoteUrl,webUrl,provider,projectKeys}; remoteUrl/webUrl nullable, provider github|gitlab|other, projectKeys explicitly reference project keys in the same declaration. Keys are caller-supplied local identifiers, not server entity UUIDs. Replace the scope atomically through task PATCH. identified needs at least one project; to_identify may carry a partial list; not_applicable requires both lists empty. Legacy absent scope remains absent. Markdown specification stays independent.

## New summary input

commitReport = {hasCommits:boolean, commits:[]} is required on every new RecordExecution, including close_activity.execution. false requires an empty list; true requires 1..100 references. Each reference: {repositoryKey,branch:{state:named|detached|unknown,name:string|null},hash,availability:local|published|unknown,remoteVerifiedAt:string|null,commitUrl:string|null}. named requires a nonblank branch name; detached/unknown require null name. Hash is full 40- or 64-digit hexadecimal. repositoryKey must resolve in the current task.workScope. Duplicate repository/hash references are rejected.

published is the submitter's explicit declaration of remote confirmation and requires RFC3339 remoteVerifiedAt; local/unknown require null. commitUrl is optional even for published commits; local/unknown forbid links. Supplied links require a recognized provider and explicit webUrl: GitHub webUrl/commit/hash or GitLab webUrl/-/commit/hash, including explicitly configured self-hosted repository URLs. No SSH-to-web guessing, network calls or publication verification by the server. HTTP(S) links reject credentials, queries, fragments and executable schemes. SSH remotes may contain an SSH login, never a password; HTTP remotes reject all userinfo.

## Historical response

ExecutionSummary.commitReport is optional for legacy reads. New references include an additional server-owned repository snapshot (the complete matching repository object); later task scope edits cannot rewrite those names/URLs/project relationships. Missing legacy declaration is not false. Exact saved POST/compound replays precede the new requirement. Status, summary, commit evidence, usage and optional interval changes share the existing UnitOfWork and replay key.

## Attachments

Existing listAttachments already supports fileName (literal case-insensitive substring), mediaType (exact case-insensitive MIME type), includeRemoved, author filter, dates and pagination. These filters combine before count/pagination in both adapters. The attachment service actually records declared actorId/actorKind; no inferred author will be introduced. Keep the existing filter contract unless tests expose a defect. Deleted content remains unavailable for download when metadata is included.

## Verification (2026-11-03)

- Full `cargo test --locked --features mcp -j 1`: 139 passed. Shared app fixtures used isolated SQLite; PostgreSQL-specific targets and all four portable transfer driver pairs used PostgreSQL 18 on the disposable loopback test container.
- Repeated `backend_repositories` (3) and `backend_files` (2) on isolated PostgreSQL: 5 passed. New atomicity tests compare persisted before/after states to avoid conflating PostgreSQL microsecond timestamps with immediate mutation responses; exact idempotent responses remain compared without normalization. The adjusted repository tests also passed again on SQLite.
- New coverage: optional task scope, create/PATCH validation and atomicity, Markdown independence, multiple repository snapshots, named/detached/unknown branches, local/published/unknown availability, full SHA-1/SHA-256, secure GitHub/GitLab links, malformed reports and HTTP/MCP compound rollback, unchanged snapshots after task edits, and exact saved legacy replays with missing commitReport.
- Existing Files filters tested in combination before count/pagination, including literal filename substring, MIME, removed state and HTTP/MCP parity. No new metadata or synthetic authors added.
- `cargo build --locked --features mcp -j 1` passed. Catalog regenerated: 78 tools, 17 resources, 3 prompts. All 15 source/bundle SHA-256 pairs verified against Skills commit 562c53ebb4559efe73cacc7efb490808b5c6d1b0; SQLite bootstrap overlays retained. No source Skills files copied into this backend commit.
- Product runtime/data untouched. API/UI runtime rollout and human acceptance remain separate.
