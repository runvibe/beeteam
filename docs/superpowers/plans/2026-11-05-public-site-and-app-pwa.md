# Separate the Bee Team public site and installable app

Status: proposed, backlog. This plan covers two independently reviewable deliveries in the current repository and on the same domain.

## Product and release boundaries

Keep `frontend/` as the React/Vite app and add `site/` for the Vike public site. Extract only the tokens, Manrope assets, icons, locale preferences and presentational components actually used by both. Each product owns its entry point, dependencies, assets, build, tests and rollback. The public site can publish editorial changes independently. The app build retains the exact Cargo application version check against the local API. Show the documented release on version-sensitive articles and generate their tool and environment references from that release's contracts.

| URL | Owner and behavior |
| --- | --- |
| `/`, `/guide/`, `/guide/<topic>` | Static English landing and articles. Preserve existing guide slugs, step anchors and harness query parameters. |
| `/pt/`, `/pt/guide/…` | Equivalent Portuguese pages. Explicit locale URLs win; the language control opens the corresponding article and preserves its step and harness. |
| `/install`, `/install.json` | Keep the assistant-readable setup guide and validated release manifest at their existing addresses. A content-only publish must preserve the promoted manifest. |
| `/app/`, `/app/…` | Installable app and its deep links. Keep supported legacy app links working with history and query parameters. |
| `/api/…`, `/mcp`, `/docs`, `/openapi`, `/health` | Preserve the local service's protocol routes, Swagger and configured MCP path. No UI fallback for these routes or missing assets. |

## Delivery 1 — Public site with Vike

1. **Baseline the routes.** Inventory public pages, existing app aliases, links between products, asset paths, the English/Portuguese catalogs and the embedded build inputs. Capture current desktop/mobile landing and guide flows as regression examples.
2. **Build static pages.** Pin compatible Vike/React/Vite versions. Pre-render the landing and every guide article in both languages. Compute article selection, headings, initial locale and metadata at build time. Defer browser storage, viewport measurement, clipboard and local API access to the browser. Keep the hero animation, theme controls, harness switching, copy actions and tool search interactive after hydration. Include readable commands and reference content in the initial HTML; use one canonical URL per language/article regardless of selected harness.
3. **Publish discoverable URLs.** Give each page a unique title, description, canonical URL, language alternatives and share metadata. Generate a sitemap for public pages and a robots policy for the hosted site. Keep app URLs out of the sitemap and mark the app shell `noindex`. Test a real 404 for unknown public pages.
4. **Compose two artifacts.** Give site and app assets separate namespaces. Build each into an isolated output. Update Cloudflare routing so a direct article URL serves that article's generated HTML and app navigations use the app shell. For the optional Rust embedded mode, package a snapshot of both artifacts; extend Node/Rust input hashes, manifest verification, MIME handling and route tests. Keep the binary usable without Node or a network fetch at runtime.
5. **Release and roll back.** Promote the site and app independently on the hosted environment; combine the selected site snapshot and matching app at binary release time. Retain previous assets during promotion so already-open pages can still load their chunks. An editorial deployment must not advance the required app version. Exercise rollback for each artifact on a preview deployment before production.

**Acceptance:** Read an entire article, follow its menu and see the localized title with JavaScript disabled. Inspect the actual HTTP response for both languages, canonical/hreflang and article body. With JavaScript enabled, switching harness changes commands in the same step; existing deep links and the landing installation flow still work. Exercise Vite development, Cloudflare preview and an isolated embedded binary, including API/MCP-only startup. Verify site-only deployment leaves the app artifact and version gate intact.

## Delivery 2 — PWA for the app

1. Add the app manifest with stable ID, start URL and scope under `/app/`, standalone display, appropriate theme colors, and regular/maskable Bee Team icons. Register the service worker from `/app/sw.js` for that scope only.
2. Cache the versioned app shell and a bounded allowlist of same-origin app assets. Provide an offline shell that explains how to reconnect. Readiness, version checks, task data and mutations must always go to the local service. Exclude site HTML, the installation manifest, API/MCP traffic and SSE from service-worker caching. A controlled app tab may request URLs outside its scope; enforce the allowlist in the fetch handler itself.
3. Keep the service worker revalidatable. Stage complete cache versions before activation, inform users when a new shell is ready, and apply it on a safe reload. Preserve open forms, multiple tabs and prior assets until the update is safe. Re-run the API compatibility check after reconnecting. An optional newer release and a mandatory panel/API mismatch keep their distinct flows.
4. Verify install, standalone launch, deep links, offline/reconnect, version mismatch, optional updates, two open tabs and recovery from a failed cache update. Record actual browser/device coverage. Check that visiting the public site after installing the app still returns fresh pre-rendered content.

## Owners and completion

Frontend owns the split, interaction and PWA. Documentation owns the route inventory, bilingual content and release references. Distribution owns artifact composition, Rust embedding, Cloudflare routing and rollback. Delivery 2 can be developed against the agreed app boundary, then activated after Delivery 1 passes its route checks. Gate completion on independent builds, link and metadata checks, install/update verification and review of both hosted and embedded previews.
