# Install and use the skills

| Package | First invocation | What it does |
| --- | --- | --- |
| [Setup Bee Team](../../skills/setup-bee-team/SKILL.md) | `$setup-bee-team` in Codex | Inspects an existing installation or stages a verified release and checks local readiness. Can bootstrap before MCP exists. |
| [Get a Team Lead](../../skills/get-a-team-lead/SKILL.md) | `$get-a-team-lead` | Forms or selects the team, assigns work, coordinates comments and review. |
| [Get a Worker](../../skills/get-a-worker/SKILL.md) | `$get-a-worker` | Registers or resumes the assigned identity, verifies membership, and executes assigned tasks. |

For an authorized source checkout, run the following inside a fresh project, replacing the quoted path with the checkout's absolute skills directory. Select one harness. The default scope is the project.

```sh
npx skills@1.7.6 add "/absolute/path/to/beeteam/skills" --skill setup-bee-team get-a-team-lead get-a-worker -a codex --copy
```

For Claude Code use `-a claude-code`. For GitHub Copilot CLI use `-a github-copilot`. Start a fresh chat in the project and ask for the skill by name. Verify that it is discovered. For a released installation select the same immutable tag as the verified app archive. The [bootstrap reference](../../skills/setup-bee-team/references/bootstrap.md) documents release installation and manual fallback.

For existing installations, inspect the real discovery directory, back up the complete old packages outside discovery, reconcile customized files and verify hashes before replacement. Keep rollback copies. See [migration and readback](../skills-installation.md).

A bundled MCP resource is content the service can return to a connected client. Installing a skill puts files in the harness discovery path. Check each independently. Role skills resolve the persisted team and role, read its Unicode icon and normalize only their own chat title. A name or icon alone cannot establish profile identity.
