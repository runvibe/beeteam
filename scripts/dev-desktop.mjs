// Runs the desktop app against a live Vite dev server (frontend hot reload).
// Requires `npm run dev` in frontend/ and an API reachable by its proxy.
// Rebuilds and relaunches the app when desktop/src changes.
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildEmbeddedFrontend } from "./build-distribution.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const devUrl = process.env.BEE_DESKTOP_DEV_URL || "http://127.0.0.1:5173/app/";

try {
  await fetch(devUrl);
} catch {
  console.error(`Frontend dev server not reachable at ${devUrl}; start it with: cd frontend && npm run dev`);
  process.exit(1);
}

// The beeteam crate embeds a frontend build at compile time.
const dist = buildEmbeddedFrontend(root);
let child;
let restartTimer;

function launch() {
  child = spawn(
    "cargo",
    ["run", "--locked", "--manifest-path", resolve(root, "desktop", "Cargo.toml")],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, BEE_FRONTEND_DIST: dist, BEE_DESKTOP_DEV_URL: devUrl },
    },
  );
  const current = child;
  current.on("exit", (code) => {
    if (current === child && !restartTimer) process.exit(code ?? 0);
  });
}

watch(resolve(root, "desktop", "src"), { recursive: true }, () => {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log("desktop/src changed; rebuilding…");
    const previous = child;
    previous.once("exit", () => {
      restartTimer = undefined;
      launch();
    });
    previous.kill("SIGTERM");
  }, 300);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child?.kill("SIGTERM");
    process.exit(0);
  });
}

launch();
