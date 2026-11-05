import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../deploy/site/worker.mjs";
const responses = {
  "/index.html": ["<h1>Landing</h1>", "text/html"],
  "/pt/index.html": ["<h1>Português</h1>", "text/html"],
  "/guide/about/index.html": ["<h1>About Bee Team</h1>", "text/html"],
  "/app/index.html": ["<div>App</div>", "text/html"],
  "/app/sw.js": ['self.addEventListener("fetch",()=>{});', "text/javascript"],
  "/app/manifest.webmanifest": ["{}", "application/manifest+json"],
  "/install/index.html": ["Setup Bee Team", "text/html"],
  "/install.json": ['{"appVersion":"0.1.0"}', "application/json"],
};
const env = {
  ASSETS: {
    async fetch(r) {
      const item = responses[new URL(r.url).pathname];
      return item
        ? new Response(item[0], { headers: { "content-type": item[1] } })
        : new Response(null, { status: 404 });
    },
  },
};
test("public deep links use their own generated HTML while app navigation uses its shell", async () => {
  for (const [path, body] of [
    ["/", "Landing"],
    ["/pt/", "Português"],
    ["/guide/about", "About Bee Team"],
    ["/app/boards", "App"],
    ["/boards", "App"],
    ["/install", "Setup Bee Team"],
  ]) {
    const r = await worker.fetch(
      new Request("https://getbee.team" + path),
      env,
    );
    assert.equal(r.status, 200, path);
    assert.match(await r.text(), new RegExp(body));
  }
  for (const path of [
    "/guide/unknown",
    "/pt/unknown",
    "/app/assets/missing.js",
    "/api/v2/tasks",
    "/mcp",
    "/docs",
  ]) {
    assert.equal(
      (await worker.fetch(new Request("https://getbee.team" + path), env))
        .status,
      404,
      path,
    );
  }
});
test("service workers revalidate, manifests and install metadata retain their types", async () => {
  for (const [path, type] of [
    ["/app/sw.js", "text/javascript"],
    ["/app/manifest.webmanifest", "application/manifest+json"],
  ]) {
    const r = await worker.fetch(
      new Request("https://getbee.team" + path),
      env,
    );
    assert.equal(r.headers.get("content-type"), type);
    assert.equal(r.headers.get("cache-control"), "no-cache");
  }
  const r = await worker.fetch(
    new Request("https://getbee.team/install.json"),
    env,
  );
  assert.match(r.headers.get("cache-control"), /max-age=60/);
  assert.match(r.headers.get("content-type"), /application\/json/);
});
