import type { Plugin } from "vite";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

export function pwa(): Plugin {
  let directory = "";
  return {
    name: "beeteam-app-pwa",
    apply: "build",
    configResolved(config) {
      directory = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      function collect(dir: string): string[] {
        return readdirSync(dir).flatMap((name) => {
          const file = join(dir, name);
          return statSync(file).isDirectory() ? collect(file) : [file];
        });
      }
      const assetPaths = collect(join(directory, "assets")).filter((file) =>
        /\.(?:js|css|woff2?|svg|png)$/.test(file),
      );
      assetPaths.push(
        join(directory, "manifest.webmanifest"),
        ...collect(join(directory, "icons")),
        ...readdirSync(directory).filter((name) => /^favicon.*\.(ico|svg|png)$/.test(name)).map((name) => join(directory, name)),
      );
      const total = assetPaths.reduce(
        (sum, file) => sum + statSync(file).size,
        0,
      );
      if (total > 40 * 1024 * 1024)
        throw new Error("PWA asset budget exceeded (40 MiB)");
      const names = [
        "/app/",
        "/app/theme-init.js",
        ...assetPaths.map(
          (file) =>
            "/app/" + file.slice(directory.length + 1).replaceAll("\\", "/"),
        ),
      ];
      const hash = createHash("sha256").update(
        readFileSync(join(directory, "index.html")),
      );
      assetPaths.forEach((file) => hash.update(readFileSync(file)));
      const template = readFileSync(
        new URL("./service-worker.js", import.meta.url),
        "utf8",
      );
      writeFileSync(
        join(directory, "sw.js"),
        template
          .replace("__CACHE_VERSION__", hash.digest("hex").slice(0, 20))
          .replace("__PRECACHE__", JSON.stringify(names)),
      );
    },
  };
}
