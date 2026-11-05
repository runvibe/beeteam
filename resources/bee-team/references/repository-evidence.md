# Projects, repositories, and commit evidence

## Required project, repositories discovered by Get Bee Team

Leader and Worker identify the projects actually involved in the work and provide their name and absolute root folder. A project is required; do not substitute a generic not-applicable indication or a fictitious root. The Markdown specification continues to describe requirements/deliverables/acceptance, independently of structured metadata. Do not infer associations automatically from the text.

Provide only the project folders and worktrees used in the request. Do not enumerate or register every worktree of a repository merely because they share Git objects. The root is the concrete working folder; it is neither a list of changed files nor the common Git metadata directory. A worktree with .git as a file is valid. Confirm the available absolute path and its relationship to the task; ambiguity or a missing root must be resolved before filling in the project, without inventing a directory.

The agent does NOT provide repositories, remotes, provider, web URL, or branch as scope input. Get Bee Team discovers Git/remotes/branch/worktree through local inspection of the provided root. Read the result and returned identifiers before using a repository in commit evidence; do not fabricate repositoryKey or replace discovery with a manual description. Do not confuse the harness's access to the folder with the Get Bee Team process's access: hosts/containers may see different paths. Do not substitute another root to hide an access failure.

A project folder without Git is legitimate; do not initialize Git or create a remote to satisfy registration. An inaccessible folder does not prove the absence of Git: treat discovery as pending/unavailable according to the actual result, recording the limitation. Read discovery.status: not_git indicates successful inspection without Git; unavailable indicates inability to inspect, never proven absence of Git. Preserve existing names/roots and records; do not migrate legacy scope by inference.

## Work inspection and credential protection

You may inspect the authorized checkout to confirm the root and work evidence, for example git rev-parse --show-toplevel when Git is present. This does not transfer responsibility for filling in repository input to the agent. Do not require .git to be a directory; do not use git-common-dir as the project root or scan unrelated folders/worktrees.

Remote URLs may contain secrets. Do not print raw configuration or indiscriminately run git remote -v in visible output. Before displaying any diagnostics, sanitize credentials locally; do not copy HTTP usernames/passwords/tokens, sensitive querystrings, or executable schemes into tools, comments, logs, files, or links. Discovery results do not authorize disclosing secrets. An SSH URL does not become a web URL through blind substitution.

For commit evidence, verify the actual branch/HEAD and full hash. Detached HEAD and unknown branches use the contract's explicit representation, never a fabricated name. Do not change the checkout/configuration, create commits, or push merely to fill in fields. A discovered repository without a remote remains legitimate; remote availability is not inferred from the existence of a local object.

## Declaration in every new summary

Before inserting a new summary, determine whether an actual commit occurred in the work specifically being reported. The declaration is boolean and the conditional list follows the actual contract's names/fields. Without a commit, declaring false with an empty list is valid for investigation, documentation not yet committed, a checkpoint, or other activities. Do not create a commit merely to fill in the form or declare every current HEAD as the result of this activity.

If a commit occurred, declare true and at least one complete reference per commit: the correct repository, contextual branch at the time of recording, and verified full hash. Accept multiple commits/repos when they are actually part of the work. Check scope and content/history to avoid attributing preexisting or third-party commits without evidence of their relationship to the deliverable. If the relationship is uncertain, investigate and record the limitation; do not use false to hide a known commit or invent a reference to satisfy true.

The hash identifies the commit; the branch is historical context, not a mutable position or proof of publication. Do not replace the hash with HEAD, a branch name, or a short hash. Preserve already recorded snapshots even if the branch changes later. Uncommitted changes are not commit evidence. The declaration requirement does not authorize additional commits/pushes outside the requested scope.

## Local, published, and links

Separate a locally created commit, confirmed push, and actually verified remote availability. A local object, configured remote, or tracking branch does not prove current publication. If only local, record the reference without announcing an available remote link. Commit links are optional and use only a safe web URL, a supported/configured host, and confirmed availability. Do not push merely to produce a link. Discovery recognizes github.com/gitlab.com; a custom/unknown host returns provider other and webUrl null, even if a safe remoteUrl exists. In that case do not invent a link; actually verified publication may be declared with commitUrl null.

The declaration is evidence supplied by the agent, not authentication or automatic remote verification by Get Bee Team. Do not promise that the server checked content, authorship, current branch membership, or push. Do not expose credentials in persisted URLs even if the API rejects unsafe formats.

## Persistence, legacy, and communication

The declaration and its references are part of the atomic summary/status write alongside the other requirements, including usageReport and executionTracking when applicable. An incomplete reference or false with a nonempty list does not authorize partial saving or fallback to status without a summary. Confirm persistence before communicating; on timeout, check state and preserve the idempotency key/content, without duplicating references.

Legacy records without a declaration remain absent, not false; do not invent retroactive commits or rewrite old summaries from the current checkout. Comments and notifications continue through the task/commentID protocol; a commit hash, executionId, and intervalId do not replace commentID. Collection/configuration failure is a factual limitation, not permission for fictitious IDs/paths/branches.

## Project input and explicit update

CreateTask requires workScope with only projects: 1 to 100 entries {key,name,rootPath}. key is a stable local identifier chosen by the caller, not an entity UUID; name is nonempty and rootPath absolute. Do not send status, repositories, or discovery. PATCH replaces workScope using the same format. Editing specification on a legacy task without a valid project requires workScope in the same PATCH; other legacy edits remain allowed. An existing valid project satisfies this requirement. Do not backfill legacy records by inference.

Synthetic creation fragment (other required task fields omitted):

```json
{"workScope":{"projects":[{"key":"app","name":"Application","rootPath":"C:/projects/app"}]}}
```

Synthetic legacy specification PATCH fragment, sent with If-Match for the current version:

```json
{"specification":"# Requirements\nDeliverable and acceptance criteria.","workScope":{"projects":[{"key":"app","name":"Application","rootPath":"C:/projects/app"},{"key":"docs","name":"Involved documentation","rootPath":"C:/projects/docs"}]}}
```

Use actual authorized paths in place of these examples; declare the second folder only if actually involved. To repeat discovery, resend the project list in PATCH with the current If-Match. This replaces the result atomically and increments the version. Reading a task or editing another field does not refresh discovery. An inaccessible/non-Git root may be saved; a relative/empty root or empty list is invalid. An exact POST replay preserves the original response and does not repeat discovery.

## Discovered result and evidence

Task.workScope remains optional for legacy records. New writes return status identified because the projects were declared, even if discovery fails. Each project retains key/name/rootPath and receives discovery: status detected/not_git/unavailable, reason, checkedAt, checkoutRoot, gitDirectory, commonDirectory, isWorktree, branch, headHash, repositoryKey, and remotes. reason may be null, path_unavailable, git_unavailable, timeout, output_limit, or inspection_failed. Do not expose raw errors or secrets.

rootPath is the declared folder; checkoutRoot is the Git checkout containing it and may differ. Repositories are derived from detected projects and grouped by canonical commonDirectory; only declared projects enter projectKeys. Use the returned key, never reproduce its algorithm. Each repository returns key/name/remoteUrl/webUrl/provider/projectKeys. No remote remains valid with null URLs; origin takes precedence, followed by the first named remote. Unsafe remotes may have a null URL. Discovery does not fetch or verify publication.

Every new RecordExecution requires commitReport. Without a commit in the reported work:

```json
{"commitReport":{"hasCommits":false,"commits":[]}}
```

Illustrative local commit format; replace repositoryKey and hash with actual returned/verified evidence, never send these placeholders:

```json
{"commitReport":{"hasCommits":true,"commits":[{"repositoryKey":"RETURNED_KEY","branch":{"state":"named","name":"codex/example"},"hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","availability":"local","remoteVerifiedAt":null,"commitUrl":null}]}}
```

true requires 1..100 references; a full hexadecimal hash of 40 or 64 characters; no duplicate repositoryKey/hash. named requires a name, detached/unknown use name null. local/unknown require remoteVerifiedAt and commitUrl null; published requires actual remote verification with an RFC3339 date and allows an optional link consistent with webUrl/provider. The repository snapshot is added by the server, not supplied as input. Later scope does not rewrite historical snapshots.

If a known commit cannot be related to a discovered repository due to an access failure, record the impediment and reconcile discovery; do not declare false to bypass validation, register a repo manually, or invent a reference. Also preserve the actual cumulative usageReport and executionTracking when applicable.

Prompts remain read-only: they consult scope/discovery and indicate gaps; obtaining them does not write projects, commit/push, or produce artificial evidence. Installing the skill does not update the active API.
