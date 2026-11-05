# Install Get a Team Lead and Get a Worker after integration

Execute this procedure only after the Leader integrates and reviews the Bee Team revision. The Leader performs installation. This procedure does not restart Bee Team or reload existing chats. MCP resources do not install packages globally.

| Existing package | Integrated source and destination | Action |
| --- | --- | --- |
| `call-a-team-lead` | `skills/get-a-team-lead` → `get-a-team-lead` | Back up and retire the replaced package; install **Get a Team Lead** |
| `call-a-worker` | `skills/get-a-worker` → `get-a-worker` | Back up and retire the replaced package; install **Get a Worker** |

The former invocations are retired, not discoverable skill aliases. Use `$get-a-worker` and `$get-a-team-lead`. Server compatibility is a separate Backend contract; discover actual MCP resources/tools and schemas before use. No step rewrites profiles, names, slugs, task text, historical usage evidence or other user data.

The reference domain is `getbee.team`. Preserve API routes, `beeteam://` URIs, storage/executable/crate names, preference keys and configured service addresses. This package migration performs no DNS or public deployment.

## Preflight and backup

1. Confirm the integrated commit and clean source checkout. Validate both source packages with skill-creator's `quick_validate.py`; verify every relative link resolves within its package. Compute SHA-256 for each source file.
2. Resolve the actual skills root and a backup root outside skill discovery. Resolve the four exact package paths in the table. Reject paths outside the selected skills root, links/junctions and unexpected package identities. Never scan or remove unrelated skill directories.
3. Check each existing `INSTALLATION.json` against disk, comparing SHA-256 case-insensitively. Missing manifests/files, unmanaged files or divergent hashes require reconciliation before replacement; preserve customization. If either replacement already exists, verify the complete two-package migration state. Both replacements must match integrated sources/manifests and both old folders must be absent for a no-op. A partial or divergent installation requires reconciliation rather than overwriting it.
4. Copy both complete existing packages, including metadata, to unique timestamped backup directories. Verify every copied file's hash. Save the integrated commit, original paths, backup paths and hashes in a migration manifest outside discovery. Retain these backups for rollback.

## Stage and replace

5. Stage both reviewed packages outside discovery. Create an `INSTALLATION.json` for each with `sourceCommit`, `source`, `updatedAt`, `backupPath` and the `installedFiles` SHA-256 map. Preserve applicable metadata, update package identity and paths, and omit obsolete entrypoints. Validate names, links and hashes before changing active installations.
6. Recheck resolved absolute paths immediately before moving. Retire only `call-a-team-lead` and `call-a-worker` to their unique retained backup locations; activate the validated staged packages at `get-a-team-lead` and `get-a-worker`. Do not create forwarding skills/symlinks or touch unrelated packages.
7. If replacement fails, stop and restore the original packages from verified retained copies. Remove only new files whose hashes still match this migration. Never overwrite a newly modified file during rollback; report partial state for reconciliation.

## Readback

8. Verify installed files byte-for-byte against integrated sources and manifests. Repeat package and link validation. Confirm `call-a-team-lead` and `call-a-worker` are absent from discovery, both canonical names/titles are correct and unrelated packages are unchanged.
9. Save final manifests, backup paths, integrated commit and validation results outside the repository. Report installation separately from bundle synchronization, runtime deployment and session adoption. Existing chats may retain loaded instructions; do not claim reload without observation.

## Historical installations

Earlier releases used `bee-team-leader`, `bee-team-collaborator` and `call-a-collaborator`. Their prior migration is recorded in Git history. If those directories remain, stop this migration for explicit reconciliation of that older installation; do not expand the retirement set implicitly. Historical verification reports and authored Bee Team records retain their original terminology.
