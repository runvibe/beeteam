# First public native release

## Approved outcome

Publish the first public Bee Team release for testing. Deliver native Windows, Linux and macOS binaries, the setup/lead/worker Skills from the same immutable release, and a verified installation manifest on the public site. User installation uses ready-made artifacts and an assistant request, not source compilation. The user made the repository public and authorized protection against direct commits to main.

## Execution and owners

1. **Leader:** verify public visibility and repository permissions; require pull requests and the GitHub Actions build check for main, including administrators; prohibit force pushes and deletion.
2. **Documentation worker:** update the public installation guide and main README to select a harness, copy the request to read the assistant installation instructions, install Skills and verified native packages, then connect the local service. Keep source compilation in contributor documentation only.
3. **Release worker:** add a dispatchable native release workflow with OS-native builds, isolated packaging/SQLite/MCP smoke tests, complete Skills packages, immutable version tags, artifact hashes and sizes, and draft-to-published release promotion after all jobs pass.
4. **Leader:** review scripts, contracts, package layout and workflow permissions. Merge through pull requests after checks pass, then dispatch the release matching the Cargo version. Wait for all target builds and package tests; repair actual failures without publishing unverified substitutes.
5. **Leader:** fetch the published manifest and independently verify public tag, Skills, archive sizes and SHA-256. Generate the site's static installation manifest using its own version reference, then publish it through the site repository and verify the public endpoint and assistant-first instructions.

## Acceptance

- Main protection is active and read back; ordinary commits require pull requests even for administrators.
- Native binaries come from the immutable release source and retain license/brand/third-party notices.
- Packages actually start and answer health/info/MCP using temporary data; existing product services and databases are untouched.
- All three Skills are discoverable from isolated harness directories and resolve their supporting references.
- The public manifest points only to published assets, with exact version, platform, size, SHA-256 and Skills tag; no placeholder metadata.
- Public documentation is English/Portuguese, copyable, and uses assistant-driven installation. No user compilation fallback.
- GitHub release, site deployment and actual public downloads are verified separately. Human acceptance remains separate from implementation/publication.

## Tracking

- Parent task: `01a1ad90-00fc-7300-a4c8-19ee7ec0f2d7`.
- Documentation task: `01a1ad90-98ff-7b33-b4b4-f628f3b96b8b`.
- Release automation task: `01a1ad90-9c74-7850-9ef9-0e120618dd3d`.
