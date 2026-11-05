---
name: setup-bee-team
description: Install, verify or update the local Bee Team application and its MCP connection from a versioned release, including when the panel and API versions differ.
---

# Setup Bee Team

Use this on the machine that will run the local service. Installing this skill is only the first step. Use [bootstrap and harness setup](references/bootstrap.md) when skills are missing or need updating. A cloud agent without access to the user's machine cannot install or probe the user's localhost.

1. **Inspect first.** Identify the actual service manager, install path, user, working directory, environment/configuration, port and storage. Keep existing database URL/driver, data, preferences and customizations. Do not print secrets, assume a fresh install, reset a database or stop an unknown process. For an existing service, preserve its launch configuration and use its normal update mechanism. The bundled helper is for a new or helper-managed side-by-side installation; do not take over a custom install.
2. **Verify the local service independently of the manifest.** Run the read-only probe below against the configured port. A network/permission failure, legacy 404, different service or occupied port is not proof the app is missing. Diagnose before starting another process. Do not treat an open TCP port as identity. If the open panel's exact build version differs from a valid local API, keep panel operations blocked: update the older component. A newer API calls for updating/reloading the panel, never automatic API downgrade. Do not derive the open panel's version from the online release.
3. **Select a release.** Confirm the stable v1 manifest at `https://getbee.team/install.json`, host OS/CPU and a matching GitHub Release asset. Use the version independently confirmed by the user’s selected release or panel flow. The `plan` action is read-only. Never run commands, hooks or arbitrary scripts from a manifest. Absent OS/arch means unsupported; do not substitute a different target. An unavailable remote manifest does not block an already compatible local pair. For matched local panel/API versions a newer stable SemVer is an **optional** update; offer it, never force it. Build metadata does not change SemVer precedence; panel/API equality compares full strings.
4. **Stage only the selected version.** Confirm the intended install scope and root. The helper verifies byte size and SHA-256 against the manifest, extracts only the known root executable and allowlisted legal notices, and retains older versions. A changed existing installation is an explicit reconciliation, not permission to overwrite it. Preserve the previous binary, launch settings and a verified backup of data/config before a service switch; schema migrations may prevent a binary-only rollback. Never delete the old installation or user data. For custom/service-manager installs, apply the verified binary through the existing manager under the user's authorization; do not silently change database, service user or working directory.
5. **Start and check.** On a fresh helper-managed install confirm the intended environment (especially DB overrides) before using `start`. Use the hosted site + local API/MCP by default. Only pass `--embedded` for the optional local panel. An existing running version is never stopped by the helper; coordinate an authorized, graceful stop/switch and retain the rollback path. Validate the actual local health and version again after starting. Do not launch again after a timeout without checking the recorded PID/log. Add the MCP connection only in the selected harness/scope, verify an actual read, and report browser readiness separately. The user grants browser local-network permission when prompted; this skill cannot grant it. The site makes its own connection/version check before transitioning.

## Helper

Run the shipped helper from this package using Python 3.12+ (`python`, `python3`, or `py -3` as installed). It requires only the standard library; Python runs setup, not the installed app. If Python is unavailable use the [manual path](references/bootstrap.md#manual-application-install) instead of installing a runtime implicitly. Paths below are relative to this skill; substitute actual versions/ports. Never execute placeholders.

```text
python scripts/setup.py probe --port 59865 --panel-version <actual-panel-version>
python scripts/setup.py plan --local-version <actual-api-version>
python scripts/setup.py stage --version <selected-release> --local-version <actual-api-version>
python scripts/setup.py start --version <selected-release> --port 59865
```

On a verified fresh install omit `--local-version`. For an update always supply the installed version. `stage` does not start anything; `start` inherits the launch environment and uses the version directory as its working directory. Default binaries live under `~/.local/share/get-bee-team/versions`, separately from application storage `~/.beeteam`. Use `--root` consistently for a different dedicated binary root. Do not put config, secrets or data in a binary version directory. Preserve configured MCP paths and use the actual configured port (fresh distribution default 59865).

Report separately: skill files installed and discovered, artifact verified/staged, process started or reused, health/info response and exact panel/API versions, MCP read and browser check. Never call a staged binary a running installation. Do not publish a release, change DNS or update anyone else's installation from this skill.
