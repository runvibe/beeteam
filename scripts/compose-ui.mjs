import { createHash } from "node:crypto";
import {
  readdirSync,
  readFileSync,
  lstatSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  cpSync,
  rmSync,
} from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { sourceHash } from "../frontend/scripts/build-inputs.mjs";

export function inventory(root, exclude = new Set()) {
  if (lstatSync(root).isSymbolicLink())
    throw new Error("Build inputs cannot be symlinks");
  return readdirSync(root).flatMap((name) => {
    if (exclude.has(name)) return [];
    const path = resolve(root, name);
    if (lstatSync(path).isSymbolicLink())
      throw new Error("Build inputs cannot be symlinks");
    return lstatSync(path).isDirectory() ? inventory(path, exclude) : [path];
  });
}
export function siteSources(root) {
  return inventory(
    resolve(root, "site"),
    new Set(["node_modules", "dist", ".vite", ".git"]),
  )
    .map((path) => ({
      path: relative(root, path).replaceAll("\\", "/"),
      sha256: digest(path),
    }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}
const digest = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
export function compose(root, appDist, siteDist, output) {
  root = realpathSync(root);
  output = resolve(output);
  const allowed = resolve(root, ".local") + "/";
  if (!output.replaceAll("\\", "/").startsWith(allowed.replaceAll("\\", "/")))
    throw new Error("Composition must stay in repository .local");
  if (output === resolve(appDist) || output === resolve(siteDist))
    throw new Error("Composition cannot replace an input");
  if (lstatExists(output) && realpathSync(output) !== output)
    throw new Error("Composition output cannot be a link");
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const siteManifest = JSON.parse(
    readFileSync(resolve(siteDist, ".beeteam-site-build.json"), "utf8"),
  );
  if (
    JSON.stringify(siteManifest.siteSources) !==
    JSON.stringify(siteSources(root))
  )
    throw new Error("Stale site build");
  verifyOutput(siteDist, siteManifest, ".beeteam-site-build.json");
  const originalAppManifest = JSON.parse(
    readFileSync(resolve(appDist, ".beeteam-build.json"), "utf8"),
  );
  verifyOutput(appDist, originalAppManifest, ".beeteam-build.json");
  if (lstatExists(resolve(siteDist, "app")))
    throw new Error("Public site must not own the app namespace");
  // Reject link inputs before recursive copying.
  inventory(appDist);
  inventory(siteDist);
  cpSync(siteDist, output, { recursive: true });
  mkdirSync(resolve(output, "app"), { recursive: true });
  cpSync(appDist, resolve(output, "app"), { recursive: true });
  const appManifest = JSON.parse(
    readFileSync(resolve(appDist, ".beeteam-build.json"), "utf8"),
  );
  if (appManifest.sourceHash !== sourceHash(resolve(root, "frontend")))
    throw new Error("Stale application build");
  const manifest = {
    ...appManifest,
    siteSources: siteSources(root),
    files: inventory(output)
      .filter(
        (path) =>
          ![".beeteam-build.json", ".beeteam-site-build.json"].includes(
            path.split(/[\\/]/).at(-1),
          ),
      )
      .map((path) => ({
        path: relative(output, path).replaceAll("\\", "/"),
        sha256: digest(path),
      }))
      .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path))),
  };
  rmSync(resolve(output, "app/.beeteam-build.json"), { force: true });
  rmSync(resolve(output, ".beeteam-site-build.json"), { force: true });
  writeFileSync(
    resolve(output, ".beeteam-build.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return output;
}
function lstatExists(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function verifyOutput(root, manifest, excluded) {
  const actual = inventory(root)
    .filter((p) => relative(root, p) !== excluded)
    .map((p) => relative(root, p).replaceAll("\\", "/"))
    .sort();
  const expected = manifest.files.map((item) => item.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error("Artifact inventory mismatch");
  for (const item of manifest.files) {
    if (
      !actual.includes(item.path) ||
      item.path.split("/").some((x) => !x || x === "." || x === "..") ||
      item.path.includes("\\")
    )
      throw new Error("Unsafe artifact entry");
    if (digest(resolve(root, item.path)) !== item.sha256)
      throw new Error("Artifact hash mismatch");
  }
}
