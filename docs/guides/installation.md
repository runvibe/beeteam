# Install Bee Team

## Ask your assistant to install it

Open the [installation guide](https://getbee.team/guide/installation), choose your harness, and copy the installation request into its chat:

```text
Follow https://getbee.team/install to install Bee Team on my computer using this assistant. Verify the published release and confirm that the local API is running.
```

The assistant reads the setup instructions and the [installation manifest](https://getbee.team/install.json), identifies your operating system and CPU, and installs **Setup Bee Team**, **Get a Team Lead** and **Get a Worker** from the same immutable GitHub release tag as the binary. It confirms that the harness discovers Setup Bee Team before using it to install or update the native application.

This user installation path uses ready-to-run native artifacts. It does not require checking out this repository, installing a Rust compiler or building the frontend.

## Choose a published native package

Windows, Linux and macOS are release targets; the [published release](https://github.com/runvibe/beeteam/releases) and manifest list the operating-system/architecture combinations actually available. A workflow definition alone is not evidence that a package is published. If the manifest, matching archive or Skills tag cannot be verified, the assistant reports that installation is unavailable and stops rather than substituting another version or origin.

The setup skill checks the archive's exact origin, version, filename, byte length and SHA-256 before extraction. Windows uses ZIP with a root `beeteam.exe`. Linux and macOS use tar.gz with a root `beeteam`. The app and all three Skills must come from the same verified release tag. See the [manifest contract](../install-manifest.md) and [bootstrap reference](../../skills/setup-bee-team/references/bootstrap.md).

## Start and connect

Setup Bee Team starts or reuses the identified local service, checks its health and version, and reports the result. Open [the hosted app](https://getbee.team/app/) in a browser on the same computer and allow local service access if prompted. It expects `http://127.0.0.1:59865/api/v1`; service and app versions must match.

To start an already installed binary manually, open its installation folder:

**Windows PowerShell**

```powershell
.\beeteam.exe
```

**macOS or Linux**

```sh
./beeteam
```

Keep a foreground terminal open while using Bee Team. Do not start a second instance if the service is already running. API and MCP run by default. To serve the optional bundled UI, set `BEE_FRONTEND_MODE=embedded` before starting the installed binary and open `http://127.0.0.1:59865/app/`. See [runtime modes](runtime.md).

In a second terminal, read `http://127.0.0.1:59865/health` and `http://127.0.0.1:59865/api/v1/info` using PowerShell's `Invoke-RestMethod` or `curl -fsS` on macOS/Linux. The [local connection walkthrough](https://getbee.team/guide/local-connection) explains startup, browser permission and the expected port.

## Update an existing installation

Ask Setup Bee Team to check the release and installation before changing it. Record the current version, database location, launch environment and service manager. Preserve a verified data backup and the prior binary. Stop only the identified instance, replace it with the verified native archive, restart and repeat the health, version and board checks. Restore a compatible backup if migrations prevent binary-only rollback.

Inspect and back up customized Skills before replacement. See [Skills installation](skills.md).

## Contributor builds

Building from source is a development workflow, separate from published-archive installation. Contributors can follow [Development and tests](development.md) for native toolchain and packaging commands.
