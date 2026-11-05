import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readFileSync, mkdtempSync, realpathSync } from "node:fs";
import { resolve, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { frontendInputs, externalInputs, sourceHash } from "../frontend/scripts/build-inputs.mjs";
const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const workspace = resolve(root, ".local/cloudflare");
mkdirSync(workspace, { recursive: true });
if (realpathSync(workspace) !== workspace) throw new Error("Staging must not traverse a junction");
const staging = mkdtempSync(resolve(workspace, "build-"));
const frontend = resolve(staging, "frontend");
mkdirSync(frontend);
const expected = sourceHash(resolve(root, "frontend"));
for (const name of [...frontendInputs, ...externalInputs]) {
  const target = resolve(frontend, name);
  if (!target.startsWith(staging + sep)) throw new Error("Invalid build input");
  mkdirSync(dirname(target), { recursive: true });
  cpSync(resolve(root, "frontend", name), target, { recursive: true });
}
if (sourceHash(frontend) !== expected) throw new Error("Build input changed during staging");
if (!process.env.npm_execpath) throw new Error("Run this build through npm run build");
for (const args of [["ci", "--include=dev"], ["run", "build"]]) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: frontend, stdio: "inherit",
    // Hosted UI calls the user's loopback API, never the public site's /api.
    env: { ...process.env, NODE_ENV: "production", VITE_API_MODE: "http", VITE_API_BASE_URL: "http://127.0.0.1:59865/api/v1" },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const output = resolve(root, ".local/cloudflare/app");
if (relative(root, output).replaceAll("\\", "/") !== ".local/cloudflare/app") throw new Error("Unsafe staging directory");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(resolve(frontend, "dist"), resolve(output, "app"), {
  recursive: true, filter: (path) => !path.split(/[\\/]/).some((part) => part.startsWith(".beeteam-")),
});
const manifest = JSON.parse(readFileSync(resolve(output, "app/manifest.webmanifest")));
if (manifest.scope !== "/app/" || manifest.start_url !== "/app/") throw new Error("Incorrect PWA scope");
console.log("Cloudflare app staged under /app/ with the local API endpoint.");

if (realpathSync(staging).startsWith(workspace + sep)) rmSync(staging, {recursive: true, force: true});
