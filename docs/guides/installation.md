# Install Bee Team

## Choose a distribution

As of November 5, 2026 GitHub reported zero releases and zero runs of the native candidate workflow. The repository was private. The reference domain returned HTML at the install manifest path. Use an authorized checkout for now.

| OS and CPU | Native build path | Native archive smoke | Published archive |
| --- | --- | --- | --- |
| Windows x64 | PowerShell below | See [verification](verification.md) | None |
| Windows arm64 | Source, unverified | Unverified | None |
| Linux x64 | POSIX shell below | Unverified | None |
| Linux arm64 | Source, unverified | Unverified | None |
| macOS arm64 | POSIX shell below | Unverified | None |
| macOS x64 | Source, unverified | Unverified | None |

The workflow runs on native Windows, Ubuntu and macOS runners. Packaging determines architecture from the actual runner. A workflow definition alone cannot establish support for every CPU.

## Build from source

Install a native Rust toolchain (Cargo and rustc 1.94+), the platform linker and C/C++ build tools, and Node.js 22.20+ with npm. On Windows use the MSVC build tools and Windows SDK, on macOS the Xcode command line tools, and on Linux the system C compiler and development tools. From the checkout root:

```sh
node scripts/build-distribution.mjs
```

The script stages dependencies in `.local/distribution/frontend` and embeds the matching UI. With Cargo's default target directory the binary is in `target/release`. Node is needed only to build.

**Windows PowerShell**

```powershell
$env:BEE_FRONTEND_MODE = 'embedded'
.\target\release\beeteam.exe
```

**macOS and Linux**

```sh
BEE_FRONTEND_MODE=embedded ./target/release/beeteam
```

Use a second terminal for readiness. In PowerShell run `Invoke-RestMethod http://127.0.0.1:59865/health` and `Invoke-RestMethod http://127.0.0.1:59865/api/v1/info`. In a POSIX shell use `curl -fsS` with each URL. Expect a healthy service and an info object with the app version and supported contract versions. Open the local panel at `http://127.0.0.1:59865/app/`. Stop your foreground instance with Ctrl+C. Restart with the same working directory, environment and data location.

## When a release becomes available

Check the [release list](https://github.com/runvibe/beeteam/releases) against the [manifest contract](../install-manifest.md). Match OS, CPU, tag, exact archive name, byte length and SHA-256. Windows uses ZIP with a root `beeteam.exe`. Unix uses tar.gz with a root executable `beeteam`. In PowerShell compare `Get-FileHash -Algorithm SHA256 $archive` with the manifest, where `$archive` is the downloaded file. On Linux use `sha256sum "$archive"`; on macOS use `shasum -a 256 "$archive"`. Stage in a fresh directory and use the [setup package](../../skills/setup-bee-team/SKILL.md) to verify extraction and launch.

Before upgrading, record the current version, database location, launch environment and service manager. Keep a verified data backup and the prior binary. Stop only the identified instance, switch the executable, restart and repeat the info and board checks. Restore a compatible backup if migrations prevent binary-only rollback.
