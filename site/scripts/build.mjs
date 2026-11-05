import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { siteSources } from "../../scripts/compose-ui.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
const cwd = resolve(root, "site");
const before = siteSources(root);
const result = spawnSync(
  process.execPath,
  [resolve(cwd, "node_modules/vike/bin.js"), "build"],
  { cwd, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
if (JSON.stringify(before) !== JSON.stringify(siteSources(root)))
  throw Error("Public site sources changed during build");
const dist = resolve(cwd, "dist/client");
const files = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(d, e.name)) : [resolve(d, e.name)],
  );
const normalized = (p) => relative(dist, p).replaceAll("\\", "/");
const html = files(dist).filter(
  (p) =>
    normalized(p).endsWith("index.html") &&
    !normalized(p).startsWith("install/") &&
    !normalized(p).includes("guide/about/"),
);
const urls = html.map(
  (p) => "https://getbee.team/" + normalized(p).replace(/index.html$/, ""),
);
writeFileSync(
  resolve(dist, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map((u) => "<url><loc>" + u + "</loc></url>").join("") +
    "</urlset>",
);
writeFileSync(
  resolve(dist, "robots.txt"),
  "User-agent: *\nAllow: /\nDisallow: /app/\nSitemap: https://getbee.team/sitemap.xml\n",
);
writeFileSync(
  resolve(dist, ".beeteam-site-build.json"),
  JSON.stringify(
    {
      siteSources: before,
      files: files(dist)
        .filter((p) => !p.endsWith(".beeteam-site-build.json"))
        .map((p) => ({
          path: normalized(p),
          sha256: createHash("sha256").update(readFileSync(p)).digest("hex"),
        })),
    },
    null,
    2,
  ),
);
