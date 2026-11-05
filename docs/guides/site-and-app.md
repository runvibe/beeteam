# Public site and installable application

Bee Team has two frontend entry points in separate repositories. The [Vike public site](https://github.com/runvibe/beeteam-site) renders the landing and documentation into HTML during its build. This application repository pins that repository as the `site/` Git submodule for combined previews and embedded binary distribution. The React/Vite app remains in `frontend/`, runs under `/app/`, connects to the local service and checks the full application version before allowing work.

Clone with `git clone --recurse-submodules`, or run `git submodule update --init --recursive` in an existing checkout. This checks out the exact site revision recorded by the application repository; updating that pin is a separate reviewed change. The API and standalone app build do not require the site checkout. Combined builds do require it and fail if it is missing.

While the site repository is private, developers need GitHub SSH read access. The distribution-candidates workflow needs a `BEETEAM_SITE_READ_TOKEN` Actions secret with read access to both repositories for recursive checkout. The ordinary `GITHUB_TOKEN` only covers this repository and cannot fetch a different private repository. No token is stored in the submodule URL. The public-site build and publication workflow belongs to the site repository.

## Public pages

English pages use `/` and `/guide/<topic>`. Portuguese pages use `/pt/` and `/pt/guide/<topic>`. Each article has a canonical URL, language alternatives and indexable text. Harness selection changes the instructions inside an article and is preserved in its query string. The standalone `/install` document and `/install.json` retain their installation roles.

From `site/`, run `npm ci` and `npm run build` to generate `dist/client`. The site can also be cloned and built independently. Use `npm run dev` while editing the public site. A public-site release can refresh editorial content while the promoted app remains at its current Cargo version. The environment and MCP references are versioned snapshots owned by the site repository; refreshing them from an application release is explicit. Combined build source verification inventories the pinned site's own files, excluding Git metadata and generated output.

## Application and PWA

From `frontend/`, run `npm ci`, then `npm run dev` or `npm run build`. App assets, the web manifest and the service worker are scoped to `/app/`. The browser can install the app where supported. Offline startup shows connection guidance; accessing or changing task records requires the local API.

When an app update is ready, follow the reload prompt after saving your work. Reloading rechecks API compatibility. Keep the exact panel/API version requirement separate from the optional notification that a newer stable release exists.

## Distribution checks

To inspect both products together, run `node scripts/build-ui.mjs`, then `node scripts/preview-ui.mjs 5177`. This preview serves `.local/site-candidate` using the hosted routing rules. For app development, Vite also serves the last built public site at public URLs and retains HMR under `/app/`.

For a site-only promotion, run `node scripts/stage-site-update.mjs <previous-composed-artifact> <site/dist/client> <new-.local-path>`. The staged output preserves the promoted app, release manifest and previous immutable site chunks. Check that candidate before publishing it.

The combined binary build uses `node scripts/build-distribution.mjs`. Both artifact sets are embedded for optional local UI serving; the Rust service requires no Node process at runtime. Enable the local interface with `BEE_FRONTEND_MODE=embedded`. Its default API/MCP-only mode is available independently.

Before publishing, inspect the generated HTML with JavaScript disabled, exercise direct article URLs in both languages, and verify the selected harness after hydration. Install the app in a supported browser, test offline/reconnect and multiple open tabs, and confirm API/MCP responses never come from a service-worker cache. Repeat route checks on the composed Cloudflare preview and an isolated embedded binary.
