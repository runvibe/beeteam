# Installation manifest and site promotion

The public contract is `GET /install.json`:

- `schemaVersion`: integer `1`; `appVersion`: complete stable Cargo SemVer;
  `channel`: `stable`.
- `artifacts`: nonempty array of published pairs. Each item has `os`
  (`windows`, `linux`, `macos`), `arch` (`x64`, `arm64`), `format` (`zip` on
  Windows, `tar.gz` elsewhere), `fileName`, HTTPS GitHub Release `url`, lowercase
  SHA-256 `sha256` and positive integer byte `size`. Pairs cannot repeat.
- `skills`: `{repository, ref, path, names}`. Repository is the same HTTPS GitHub
  repository as the release assets; `ref` is `v<appVersion>`, `path` is `skills`,
  names are `setup-bee-team`, `get-a-team-lead`, `get-a-worker`.

Sidecar archive metadata comes from `package-release.py`. It is a candidate,
not proof of public availability. Assemble the envelope from native CI assets
that passed their smoke tests. Never execute commands supplied by manifest fields.

Promotion order:

1. Integrate matching Frontend, Backend and Skills, create the versioned tag and
   run native distribution candidate validation.
2. Resolve signing/notarization and platform acceptance; publish the validated
   GitHub assets and Skills tag. Keep the previous release available.
3. Build the frontend from that tag into a fresh isolated site staging directory.
   Its embedded appVersion must equal the Cargo version and manifest version.
4. Run `node scripts/install-manifest.mjs <candidate-envelope.json>
   .local/site-candidate/install.json` from the repository root. The generator
   checks version/schema/platform/URL metadata, fetches the public tag and all
   three Skills files, then streams every asset and verifies exact size/hash.
   Any missing, corrupt, rate-limited or unavailable resource prevents generation.
   There is no skip-verification publication mode.
5. In `deploy/site`, run `npm ci`, `npm run check` and `npm run preview`. Review
   the staged site and verified manifest together before an authorized deployment.
   `check` is a Wrangler dry run, not a remote deployment.

`wrangler.jsonc` has no DNS routes or account-specific resource IDs. The Worker
runs before assets, serves known UI deep links, and never returns SPA HTML for
`/install.json`, missing assets or local protocol routes. It does not proxy the
user's local API. Hashed assets cache immutably; HTML revalidates and install.json
uses a 60-second cache with revalidation. Existing CORS configuration is untouched.

Rollback must restore the previous verified site and manifest as one Worker
version while retaining the referenced GitHub files. A public Worker preview,
HTTPS-to-local-API browser permissions/denial/reconnection, and physical native
installation acceptance remain separate verification steps. Local Wrangler tests
alone do not establish those claims. Remote manifest failure must remain optional
for a matching local frontend/API pair; the frontend owns that interaction.

Configuration references: [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
and [disabling automatic HTML routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).
