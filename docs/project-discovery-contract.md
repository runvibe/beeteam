# Project roots and local Git discovery

Authorized evolution, 2026-11-03. Base bb7f9df. No product runtime/data changes.

## Stable request contract

CreateTask requires workScope: {projects: [{key, name, rootPath}]} with 1..100 projects. key is the existing caller-local stable identifier, name is nonblank, rootPath is an absolute local folder path. No status, repositories or discovery fields are accepted as input. Task PATCH accepts the same workScope replacement. Editing specification on a legacy task with no valid project requires workScope in the same PATCH; unrelated legacy edits remain allowed. Existing project scope satisfies the specification requirement. No retroactive changes or inferred project roots.

Explicit refresh: PATCH the same project list with current If-Match; it performs discovery again, replaces the derived scope atomically and increments the task version. Merely reading a task or editing other fields never refreshes. New/changed projects may be inaccessible or non-Git and still save. Relative/blank roots, empty project lists and malformed metadata reject atomically. Existing exact saved POST replays return their original response before the new project requirement and without repeating discovery.

## Stable output contract

Task.workScope remains optional for legacy and retains {status,projects,repositories}. New writes always use status=identified (the projects are declared, regardless of discovery success). Each project retains {key,name,rootPath} and adds discovery:

{status: detected|not_git|unavailable, reason: null|path_unavailable|git_unavailable|timeout|output_limit|inspection_failed, checkedAt: RFC3339, checkoutRoot: string|null, gitDirectory: string|null, commonDirectory: string|null, isWorktree: boolean|null, branch: {state:named|detached|unknown,name:string|null}|null, headHash:string|null, repositoryKey:string|null, remotes:[{name:string,url:string|null}]}

not_git means an accessible folder inspected successfully without a worktree. unavailable includes inaccessible roots, missing Git, limits and inspection failures; never store raw errors/remotes with secrets. Detected checkoutRoot is the actual enclosing checkout; rootPath remains the caller's folder. A .git file is recognized through Git rev-parse, including linked worktrees; isWorktree indicates a linked worktree (gitDirectory differs from commonDirectory). No worktree enumeration or automatic involvement of sibling worktrees.

Repositories keep the existing WorkRepository shape {key,name,remoteUrl,webUrl,provider,projectKeys}. They are derived only from detected projects and grouped by canonical commonDirectory; key is a stable hash of that path. projectKeys contains only explicitly declared projects. Prefer origin, otherwise the first named remote; keep a local repository with remoteUrl/webUrl=null. Sanitize remote userinfo/query/fragment; unsafe remotes become null. Only recognized github.com/gitlab.com remotes yield inferred webUrl/provider; unknown/self-hosted providers retain safe remoteUrl with webUrl=null/provider=other, never guessed web links. No fetch or remote publication check. Existing commitReport declarations and immutable summary snapshots remain unchanged.

## Implementation and validation

AppState composes a local Git repository adapter through a ProjectDiscovery interface. DTO validation has no IO; service orchestrates derivation. Git uses argv directly, 64 KiB per stdout/stderr stream, 3 seconds per command and 15 seconds per request batch, no shell, hooks, status, fetch or writes. Global/system configuration, environment overrides and optional locks are disabled; local remote config ignores include files. Inspection happens after replay lookup with the transaction released, then reopens and rechecks replay/version before writing; races cannot duplicate or overwrite stale state.

Test normal Git, linked worktrees, detached/unborn HEAD, multiple explicitly declared roots, no Git, unavailable folders, sanitized remotes, timeout/output caps, HTTP/MCP requirements, legacy specification edits, replays, atomicity and writes proceeding during a paused discovery adapter. Build, full suite and catalog refresh before isolated commit.

## Verification completed 2026-11-03

- Full `cargo test --locked --features mcp -j 1`: 148 passed, including isolated SQLite HTTP/MCP, PostgreSQL-specific suites and all four portable transfer driver pairs.
- `backend_project_discovery`: all 4 scenarios repeated on isolated PostgreSQL 18 passed (requirements/refresh/parity, legacy specification/replays, lock release/concurrent replay/stale version, real checkout/worktree grouping and immutable commit snapshots).
- Windows native Git fixtures verify normal checkout, nested declared folder, linked .git-file worktree, non-involved sibling worktree, detached/unborn HEAD, no Git, inaccessible roots, local-only repo, sanitized remotes, and read-only refresh. Unit tests cover bounded output and request deadline.
- `cargo build --locked --features mcp -j 1` passed. Catalog regenerated: 78 tools, 17 resources, 3 prompts. All 15 source and bundle hashes verified against Skills commit 3265680f383f4645827b341fd95104fc97b00853; source Skills files were not copied, and SQLite bootstrap overlays were retained.
- Existing repository/commit tests now explicitly exercise historical manually-declared scopes: readable and usable by summaries, while new requests accept only projects. Historical summaries/replays are not rewritten.
- Runtime API, global product databases and unrelated worktrees were not modified. Only disposable Git fixture folders and isolated databases were used for tests. Runtime rollout and human acceptance are separate.
