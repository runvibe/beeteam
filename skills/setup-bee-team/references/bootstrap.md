# Bootstrap before the app exists

Use a trusted GitHub release of `https://github.com/runvibe/beeteam`. From the official site's `/install.json`, require integer schemaVersion 1, stable appVersion, and skills.repository equal to that repository, skills.ref equal to `v<appVersion>`, skills.path equal to `skills`, and all three names. The tag must exist and contain those packages. Do not use a floating branch or execute an install command supplied by JSON. Do not guess a release, domain availability, token or backend endpoint if the manifest/repository cannot be reached. GitHub hosts the files; [skills.sh](https://skills.sh/docs/faq) is a discovery catalog, not a mirror. A release or preview need not be listed there.

## Install the skills

Pick a harness and install scope. First inspect both canonical and harness-specific skill directories. On a preexisting install, compare files to the exact prior version/managed manifest; preserve missing, modified and unmanaged files. Back up complete old packages **outside discovery**, verify hashes, stage the new packages outside discovery, then replace only the intended packages after resolving customizations. Retain previous version and rollback paths. Never run an unconditional CLI overwrite on a customized installation.

For a fresh project, substitute the verified release tag for `TAG` in the matching command below. These commands use Node 22.20+ and the skills CLI; no app or MCP server is required. Project scope is the default. For a user-scope install, confirm scope and destinations before adding `-g`. Avoid unreviewed `--all` or forced confirmation defaults.

```text
# Codex
npx skills@1.7.6 add https://github.com/runvibe/beeteam/tree/TAG/skills --skill setup-bee-team get-a-team-lead get-a-worker -a codex --copy
# Claude Code
npx skills@1.7.6 add https://github.com/runvibe/beeteam/tree/TAG/skills --skill setup-bee-team get-a-team-lead get-a-worker -a claude-code --copy
# GitHub Copilot CLI
npx skills@1.7.6 add https://github.com/runvibe/beeteam/tree/TAG/skills --skill setup-bee-team get-a-team-lead get-a-worker -a github-copilot --copy
```

Use [CLI source formats and options](https://github.com/vercel-labs/skills/blob/main/docs/commands.md) and the [agent/path matrix](https://github.com/vercel-labs/skills/blob/main/docs/agents.md) for the actual environment. Respect any authentication requirement for a private or not-yet-published repository; do not publish it to make bootstrap work.

**Offline/manual fallback:** obtain the same verified tag in a separate checkout (for example `git clone --depth 1 --branch TAG https://github.com/runvibe/beeteam`). Confirm its origin URL, resolved tag commit and the three `skills/<name>/SKILL.md` files. Run the CLI against that checkout's absolute `skills` directory, or copy each complete package including scripts/references to the confirmed discovery directory. Project examples: Codex `.agents/skills`, Claude Code `.claude/skills`, Copilot CLI `.agents/skills`. User directories vary by harness/configuration; inspect actual settings instead of copying to all default locations. Check every installed file against the selected source and avoid a duplicate discoverable copy under another name.

Open a new session or use the harness's supported refresh mechanism. Check skill discovery in that session and explicitly ask it to use **Setup Bee Team**. Codex example: “Use $setup-bee-team to check my local Bee Team installation and install or update it if needed.” In Claude Code or Copilot, use the skill by name if listed or ask the agent to read the verified installed SKILL.md. File installation, discovery, execution, and an actual API/MCP connection are separate facts.

## Manual application install

If Python is unavailable, use native download/hash/archive tools without installing extra dependencies implicitly. Select the manifest artifact for the actual OS/CPU; compare the exact GitHub Release URL, release tag and file name, byte length and SHA-256 before extracting anything. Use `Get-FileHash -Algorithm SHA256` on Windows, `shasum -a 256` on macOS or `sha256sum` on Linux. Inspect the archive in a staging directory, reject links, duplicates and non-regular executable entries; copy only the root `beeteam.exe` (Windows) or `beeteam` (Unix). Keep old binaries/config/data intact; use the prior service manager if one exists. Without a safe extraction/verification mechanism, stop with the concrete missing prerequisite.

Start with the intended existing data/config/environment, on the confirmed loopback port. New distributions with embedded-ui serve the local panel by default; set `BEE_FRONTEND_MODE=disabled` for API/MCP only. Older releases may require explicit `embedded` mode. Read `/health` (status and version) and `/api/v1/info` (apiVersion, supportedContractVersions and recognized capabilities); verify exact version and service identity. A browser's permission and successful connection must be checked separately.

## Assistant's embedded browser

Use this recovery when the hosted app fails only in the assistant's embedded browser, especially when Chrome/Edge work after local-network permission but the embedded browser never offers that prompt. Do not assume every embedded browser is unsupported. First confirm the configured loopback API identity/version with `/health` and `/api/v1/info`; a failed hosted connection alone is not a missing installation.

1. Check whether `http://127.0.0.1:<actual-port>/app/` already serves the local panel. Use the actual configured loopback address and port, not the public site, a Vite server, or an assumed default. If it works, reuse the service unchanged.
2. If the panel is disabled, inspect the actual binary and launcher/service manager. Use a verified distribution containing `embedded-ui`. Configure `BEE_FRONTEND_MODE=embedded` in that launcher's environment. Preserve its database driver/URL, storage paths, service user, working directory, port and other environment values. No database conversion, reset, duplicate backend or blanket browser-security exception is needed.
3. For an existing service, apply the change using its authorized normal graceful restart/relaunch procedure. Changing an environment variable in a different shell does not update an already running process. If the manager or stop procedure is unknown, identify it before proceeding; do not kill an unknown process. Keep the previous launch configuration for rollback.
4. For a new or stopped helper-managed installation, use the existing verified version/root/port with `python scripts/setup.py start --version <verified-version> --port <actual-port> --embedded`. The helper sets `BEE_FRONTEND_MODE=embedded`. If it returns `already-running` / `mode: unchanged`, the existing service was reused: this does **not** confirm embedded UI was enabled. Reconcile its launch configuration instead of repeatedly running `start`.
5. Verify the running API's identity and exact version again, then read `/app/` as HTML and its actual referenced JS/CSS assets. Open the local `/app/` URL in the assistant's embedded browser and confirm the connection screen gives way to the real app and a read-only API-backed view loads. A 200 response or HTML shell alone is not browser acceptance. Keep panel/API version checks and MCP configuration intact; report limitations if browser control is unavailable.

For an ordinary direct launch after the existing process has been gracefully stopped, resolve the real executable path and preserve the same environment first. PowerShell example: `$env:BEE_FRONTEND_MODE='embedded'; & '<verified-executable-path>'`. macOS/Linux example: `BEE_FRONTEND_MODE=embedded /verified/path/beeteam`. These are examples for the existing launch context, not instructions to start a second process or migrate a managed service into a shell.

If the binary reports that `embedded-ui` is unavailable, obtain an appropriate verified prebuilt distribution using the normal installation/update flow; do not silently compile, downgrade, reset data or install a separate Node server. A cloud assistant without access to the user's machine must report that boundary rather than claiming it started the user's local service. Do not disable TLS, CORS or local-network protections, expose the API publicly, or create a tunnel for this recovery.

## Connect the selected harness

Confirm the actual MCP endpoint and scope. Default for a fresh desktop service is `http://127.0.0.1:59865/mcp`; do not replace a working registration or publish local config. Examples for a default install:

| Harness | Add only if absent and authorized | Check |
| --- | --- | --- |
| Codex | `codex mcp add beeteam --url http://127.0.0.1:59865/mcp` | `codex mcp list` |
| Claude Code | `claude mcp add --transport http beeteam http://127.0.0.1:59865/mcp` | `claude mcp list` |
| GitHub Copilot CLI | `copilot mcp add --transport http beeteam http://127.0.0.1:59865/mcp`, or use interactive `/mcp add` | `copilot mcp list` |

Verify local CLI help and support first; CLI/IDE settings are not interchangeable. See [Claude Code MCP](https://code.claude.com/docs/en/mcp) and [Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers). Confirm tools are actually exposed in the intended session and perform a harmless read such as `listBoards`. Do not submit a mutation merely to test setup.
