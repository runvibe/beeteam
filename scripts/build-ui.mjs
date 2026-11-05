import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { compose } from "./compose-ui.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
for (const [directory, script] of [
  ["frontend", "build:embedded"],
  ["site", "build"],
]) {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", script],
    {
      cwd: resolve(root, directory),
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  compose(
    root,
    resolve(root, "frontend/dist"),
    resolve(root, "site/dist/client"),
    resolve(root, ".local/site-candidate"),
  ),
);
