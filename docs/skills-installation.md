# Skill name migration

Execute this procedure only after the Leader integrates the reviewed revision. This change does not authorize restarting Bee Team or reloading existing chats. The source packages are self-contained; MCP resources do not install them globally.

| Previous installed folder | Replacement source/installed folder | Display title |
| --- | --- | --- |
| `bee-team-leader` | `call-a-team-lead` | Call a Team Lead |
| `bee-team-collaborator` | `call-a-collaborator` | Call a Collaborator |

The old invocation names are retired, not aliases. Stable MCP compatibility remains at `beeteam://skills/leader` and `beeteam://skills/collaborator`; role names and user records are unchanged. All maintained repository links point to the replacement packages.

## Preflight and backup

1. Confirm the integrated commit and a clean source checkout. Validate both `skills/call-a-team-lead` and `skills/call-a-collaborator` with skill-creator's `quick_validate.py`; check every relative link stays inside its package and resolves. Compute SHA-256 for every source file.
2. Resolve the intended Codex skills root (normally `C:/Users/phili/.codex/skills`) and backup root outside skill discovery (normally `C:/Users/phili/.codex/backups`). Resolve absolute paths for all four folders in the table before moving anything. Reject paths outside the selected skills root, links/junctions, an unexpected package name, or a conflicting replacement directory. Never scan or remove unrelated skill directories.
3. Read each old `INSTALLATION.json`. Check its `installedFiles` hashes against disk. Any mismatch, missing managed file, missing manifest, or unmanaged package file requires explicit reconciliation before replacement; do not silently discard customization. If a replacement already exists, verify its manifest and exact source parity: a complete matching migration is a no-op; divergent/partial installations require reconciliation.
4. Copy each complete old package, including its installation metadata, to a unique timestamped backup directory. Verify every copied file's hash and record source/backup locations and the integrated source commit in a migration manifest. Retain these backups for rollback.

## Stage and replace

5. Stage the two new packages outside the discoverable skills root. Copy only the reviewed source package files; create an `INSTALLATION.json` containing `sourceCommit`, `source`, `updatedAt`, `backupPath`, and the `installedFiles` SHA-256 map. Preserve applicable existing metadata, but replace paths and identity fields with the new package identity. Do not carry stale old-name entrypoints into a new package. Validate staged links, names, frontmatter, and all hashes before touching active installations.
6. Move only the two explicitly replaced old directories out of the skills root into unique retained retirement directories under the backup root. Verify source/destination absolute paths again immediately before each move. Then move the two validated staged packages into the exact replacement destinations. Do not create symlinks, forwarding SKILL.md files, duplicate auto-discoverable aliases, or edit any unrelated package.
7. If any replacement step fails, stop and restore the original old directories from the verified retained copies, removing only newly installed replacement files whose hashes match this migration. Never overwrite a newly modified file during rollback. Report partial state and reconcile instead of claiming success.

## Readback

8. Verify each new installed file byte-for-byte against the integrated source and its manifest. Re-run package validation and internal-link checks against the installed paths. Confirm the two old directories are absent from skill discovery and both new frontmatter names/display titles match the table. Confirm unrelated packages are unchanged.
9. Save the final hash manifest, backup paths, source commit, and validation results outside the repository. Report installation separately from MCP bundle/runtime rollout. Existing chats may retain previously loaded instructions; do not claim reload without an explicit observation. A future invocation uses `$call-a-team-lead` or `$call-a-collaborator`.
