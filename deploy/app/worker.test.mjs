import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
const records = {
 "/app/index.html": ["<main>App</main>", "text/html"],
 "/app/sw.js": ["// service worker", "text/javascript"],
 "/app/manifest.webmanifest": ['{"scope":"/app/"}', "application/manifest+json"],
 "/app/assets/main-12345678.js": ["// application", "text/javascript"],
 "/app/favicon.svg": ["<svg/>", "image/svg+xml"],
};
const env = { ASSETS: { async fetch(request) {
 const item = records[new URL(request.url).pathname];
 return item ? new Response(item[0], { headers: { "Content-Type": item[1] } }) : new Response(null, { status: 404 });
} } };
const request = (path, method="GET") => worker.fetch(new Request("https://getbee.team"+path, {method}),env);
test("app entry and deep links use the PWA shell; canonical redirect preserves query", async () => {
 const redirect = await request("/app?tab=tasks");
 assert.equal(redirect.status, 308); assert.equal(redirect.headers.get("location"), "https://getbee.team/app/?tab=tasks");
 for (const path of ["/app/", "/app/tasks/example?tab=timeline", "/app/teams/example/information", "/app/settings"]) {
  const response = await request(path); assert.equal(response.status,200); assert.equal(await response.text(), "<main>App</main>");
 }
});
test("missing assets, protocols and site routes never receive SPA HTML", async () => {
 for (const path of ["/", "/guide/", "/install.json", "/api/v1/info", "/app/api/v1/info", "/app/mcp", "/app/assets/missing.js", "/app/.beeteam-build.json", "/app/unknown"]) assert.equal((await request(path)).status,404,path);
 assert.equal((await request("/app/", "POST")).status,405);
});
test("PWA and icons revalidate while fingerprinted assets are immutable; HEAD has no body", async () => {
 for (const path of ["/app/sw.js", "/app/manifest.webmanifest", "/app/favicon.svg"]) assert.equal((await request(path)).headers.get("cache-control"),"no-cache");
 const asset = await request("/app/assets/main-12345678.js"); assert.match(asset.headers.get("cache-control"),/immutable/);
 const head = await request("/app/", "HEAD"); assert.equal(head.status,200); assert.equal(await head.text(),"");
});
