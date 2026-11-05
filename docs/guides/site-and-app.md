# Public site and installable application

Bee Team has two frontend entry points in separate repositories. The [Vike public site](https://github.com/runvibe/beeteam-site) renders the landing and documentation into HTML during its build. The repositories have no submodule or application-build dependency between them. The React/Vite app remains in `frontend/`, runs under `/app/`, connects to the local service and checks the full application version before allowing work.

The API, PWA and optional embedded application build require only this checkout. The distribution workflow does not fetch the public site and requires no cross-repository credential. The public site owns its hosting/promotion tools and can consume an independently built application artifact when both products are hosted on one origin.

## Public pages

English pages use `/` and `/guide/<topic>`. Portuguese pages use `/pt/` and `/pt/guide/<topic>`. Each article has a canonical URL, language alternatives and indexable text. Harness selection changes the instructions inside an article and is preserved in its query string. The standalone `/install` document and `/install.json` retain their installation roles.

In the separate public-site checkout, run `npm ci` and `npm run build` to generate `dist/client`. The site can also be cloned and built independently. Use `npm run dev` while editing the public site. A public-site release can refresh editorial content while the promoted app remains at its current Cargo version. The environment and MCP references are versioned snapshots owned by the site repository; refreshing them from an application release is explicit. Each product verifies its own source/output hashes; the app build has no public-site inputs.

## Application and PWA

From `frontend/`, run `npm ci`, then `npm run dev` or `npm run build`. App assets, the web manifest and the service worker are scoped to `/app/`. The browser can install the app where supported. Offline startup shows connection guidance; accessing or changing task records requires the local API.

When an app update is ready, follow the reload prompt after saving your work. Reloading rechecks API compatibility. Keep the exact panel/API version requirement separate from the optional notification that a newer stable release exists.

## Distribution checks

For application development, use Vite in `frontend/` and open `/app/`. Run the public site independently when working on public pages. Hosting composition and editorial promotion scripts belong to the public-site repository and consume promoted app artifacts rather than application source.

The binary build uses `node scripts/build-distribution.mjs`. Only the application is embedded for optional local UI serving; the Rust service requires no Node process at runtime. Distribution binaries serve the local panel at `/app/` by default. Set `BEE_FRONTEND_MODE=disabled` for API/MCP only. Local documentation/help links open the public website.

Before publishing, inspect the generated HTML with JavaScript disabled, exercise direct article URLs in both languages, and verify the selected harness after hydration. Install the app in a supported browser, test offline/reconnect and multiple open tabs, and confirm API/MCP responses never come from a service-worker cache. Repeat route checks on the composed Cloudflare preview and an isolated embedded binary.
