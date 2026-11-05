// Build tooling only. The executable has no runtime Node or filesystem-assets dependency.
import { compose, siteSources } from "./compose-ui.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  mkdirSync,
  cpSync,
  rmSync,
  realpathSync,
  existsSync,
  lstatSync,
} from "node:fs";
import { resolve, sep, dirname } from "node:path";
import {
  frontendInputs,
  externalInputs,
  sourceHash,
} from "../frontend/scripts/build-inputs.mjs";

export function stageFrontend(root) {
  root = realpathSync(root);
  const frontend = resolve(root, "frontend");
  if (realpathSync(frontend) !== frontend)
    throw new Error("Frontend source must not traverse a symlink or junction");
  const allowed = resolve(root, ".local", "distribution") + sep;
  function directory(path) {
    if (path !== allowed.slice(0, -1) && !path.startsWith(allowed))
      throw new Error("Invalid build staging directory");
    mkdirSync(path, { recursive: true });
    if (realpathSync(path) !== path)
      throw new Error("Build staging must not traverse a symlink or junction");
  }
  const staging = resolve(root, ".local", "distribution", "frontend");
  directory(staging);
  // Validate canonical source paths before copying. Verify no input changed during staging.
  const expectedHash = sourceHash(frontend);
  for (const name of [...frontendInputs, ...externalInputs]) {
    const target = resolve(staging, name);
    if (!target.startsWith(allowed)) throw new Error("Invalid build input");
    directory(dirname(target));
    if (existsSync(target) && lstatSync(target).isSymbolicLink())
      throw new Error("Build input must not be a symlink");
    rmSync(target, { recursive: true, force: true });
    cpSync(resolve(frontend, name), target, { recursive: true });
  }
  if (sourceHash(staging) !== expectedHash)
    throw new Error("Build sources changed while staging");
  const site = resolve(root, "site"),
    siteStaging = resolve(root, ".local", "distribution", "site");
  if (existsSync(site)) {
    const snapshot = siteSources(root);
    const helper = resolve(root, "scripts/compose-ui.mjs");
    if (realpathSync(helper) !== helper || lstatSync(helper).isSymbolicLink())
      throw new Error("Site build helper cannot traverse a link");
    const stagedHelper = resolve(
      root,
      ".local/distribution/scripts/compose-ui.mjs",
    );
    directory(dirname(stagedHelper));
    if (existsSync(stagedHelper) && lstatSync(stagedHelper).isSymbolicLink())
      throw new Error("Site helper staging cannot be a link");
    cpSync(helper, stagedHelper);
    directory(siteStaging);
    // Exact source snapshot: remove retired site modules from isolated staging too.
    rmSync(siteStaging, { recursive: true, force: true });
    directory(siteStaging);
    for (const entry of snapshot) {
      const target = resolve(root, ".local", "distribution", entry.path);
      directory(dirname(target));
      if (existsSync(target) && lstatSync(target).isSymbolicLink())
        throw new Error("Site staging cannot be a symlink");
      cpSync(resolve(root, entry.path), target);
    }
    if (
      JSON.stringify(siteSources(resolve(root, ".local", "distribution"))) !==
      JSON.stringify(snapshot)
    )
      throw new Error("Site inputs changed during staging");
  }
  return staging;
}

function run(program, args, cwd, env = process.env) {
  const result = spawnSync(program, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const staging = stageFrontend(root);
  if (process.platform === "win32")
    run(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", "npm ci --include=dev"],
      staging,
    );
  else run("npm", ["ci", "--include=dev"], staging);
  run(process.execPath, ["scripts/build-embedded.mjs"], staging);
  const site = resolve(staging, "../site");
  if (process.platform === "win32")
    run(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", "npm ci --include=dev"],
      site,
    );
  else run("npm", ["ci", "--include=dev"], site);
  if (process.platform === "win32")
    run(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", "npm run build"],
      site,
    );
  else run("npm", ["run", "build"], site);
  const combined = compose(
    root,
    resolve(staging, "dist"),
    resolve(site, "dist/client"),
    resolve(root, ".local/distribution/combined"),
  );
  run(
    "cargo",
    ["build", "--locked", "--release", "--features", "mcp,embedded-ui"],
    root,
    { ...process.env, BEE_FRONTEND_DIST: combined },
  );
}
