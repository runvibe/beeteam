// Builds the macOS desktop app (unsigned, local use). Pass --run to launch it.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildEmbeddedFrontend } from "./build-distribution.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = buildEmbeddedFrontend(root);
const args = process.argv.includes("--run") ? ["run"] : ["build", "--release"];
const result = spawnSync(
  "cargo",
  [
    ...args,
    "--locked",
    "--manifest-path",
    resolve(root, "desktop", "Cargo.toml"),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, BEE_FRONTEND_DIST: dist },
  },
);
process.exit(result.status ?? 1);
