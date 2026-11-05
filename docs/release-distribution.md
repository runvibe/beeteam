# Native distribution candidates

Run `node scripts/build-distribution.mjs` to build the release binary with MCP
and the same checkout's embedded frontend. Node/npm are build dependencies only.
Run `python scripts/package-release.py --binary <executable> --output <new-directory>
--tag v<CargoVersion>` with Python >=3.11. The script derives version from Cargo,
detects the actual native OS/architecture, rejects mismatched tags and existing
output, and writes the archive plus SHA-256 and JSON metadata.

The archive contains `beeteam.exe` at its root on Windows (zip), or executable
`beeteam` on Linux/macOS (tar.gz). Metadata contains the actual archive hash and
size; its proposed GitHub URL does not prove an asset has been published.

`python scripts/smoke-distribution.py --metadata <archive>.json` verifies and
extracts that archive into a temporary directory, starts API/MCP against a
temporary SQLite database on an isolated port, checks default/disabled/embedded
modes and invalid configuration, and checks data survives restarts. It does not
use a product database or update an installed executable.

The manually dispatched `distribution-candidates.yaml` workflow checks out the
requested tag and uses native Windows, Linux and macOS runners. OS and architecture
come from the actual runner. It builds, packages, smoke-tests and uploads private
workflow artifacts; it does not publish a GitHub Release or deploy a site.
The existing Docker workflow remains independent. Only advertise platform pairs
whose archive has passed its native smoke. Local Windows validation does not prove
Linux/macOS installation or upgrades between different app versions.

Signing/notarization are not configured in this candidate workflow. Resolve the
required credentials and platform acceptance before public distribution; unsigned
candidates must not be described as signed or notarized. Publication must upload
and verify the real archives and immutable Skills tag before promoting install.json
and the matching frontend. Retain the previous release/site for rollback. Preserve
the external database and user preferences when replacing an executable.
