# Install and use the skills

## Install through your assistant

Choose your harness in the [installation guide](https://getbee.team/guide/installation) and copy its request into the assistant's chat:

```text
Follow https://getbee.team/install to install Bee Team on my computer using this assistant. Verify the published release and confirm that the local API is running.
```

The assistant reads the [setup instructions](https://getbee.team/install), verifies the release manifest and follows the release-tagged bootstrap reference to install all three complete Skill packages in the harness's supported discovery directory. This bootstrap works before the app or MCP is available. Confirm that the harness discovers Setup Bee Team before using it to download, verify and start the native binary.

Use the same immutable GitHub release tag for the app and all three Skills. If the release or package cannot be verified, report the limitation instead of substituting an unverified revision or the moving `main` branch. The [bootstrap reference](../../skills/setup-bee-team/references/bootstrap.md) documents release installation and supported scopes.

## Use the installed Skills

| Package | First invocation | What it does |
| --- | --- | --- |
| [Setup Bee Team](../../skills/setup-bee-team/SKILL.md) | `$setup-bee-team` in Codex | Inspects an existing installation or stages a verified release and checks local readiness. Can bootstrap before MCP exists. |
| [Get a Team Lead](../../skills/get-a-team-lead/SKILL.md) | `$get-a-team-lead` | Forms or selects the team, assigns work, coordinates comments and review. |
| [Get a Worker](../../skills/get-a-worker/SKILL.md) | `$get-a-worker` | Registers or resumes the assigned identity, verifies membership, and executes assigned tasks. |

Start a fresh chat in the configured project and confirm that all three Skills are discovered. The table shows Codex invocation syntax. For Claude Code, GitHub Copilot and other harnesses, select your harness in the [usage guide](https://getbee.team/guide/first-team) for its invocation syntax. If automatic discovery is unsupported, use the manual package placement instructions from the verified bootstrap reference.

For existing installations, inspect the real discovery directory, back up the complete old packages outside discovery, reconcile customized files and verify hashes before replacement. Keep rollback copies. See [migration and readback](../skills-installation.md).

A bundled MCP resource is content the service can return to a connected client. Installing a skill puts files in the harness discovery path. Check each independently. Role skills resolve the persisted team and role, read its Unicode icon and normalize only their own chat title. A name or icon alone cannot establish profile identity.

## Contributor-only source setup

Testing packages from a local checkout is a contributor workflow, not a prerequisite for native user installation. Follow [Development and tests](development.md) and the bootstrap reference when validating local changes. Do not replace release packages with source packages without explicitly choosing that development workflow.
