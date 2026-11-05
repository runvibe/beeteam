import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import { readAppVersion } from "./scripts/app-version.mjs";
import { pwa } from "./scripts/pwa-plugin.js";
import { publicSite } from "./scripts/public-site.js";
import type { PreviewServer, ViteDevServer } from "vite";

function installGuide(server: ViteDevServer | PreviewServer) {
  server.middlewares.use((req, _res, next) => {
    if (/^\/install\/?(?:\?|$)/.test(req.url ?? "")) req.url = "/install/index.html";
    next();
  });
}
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: env.BEE_API_TARGET || "http://127.0.0.1:59865",
      changeOrigin: true,
    },
  };
  return {
    base: "/app/",
    define: { __BEE_APP_VERSION__: JSON.stringify(readAppVersion()) },
    server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
    preview: { proxy },
    plugins: [publicSite(), react(), tailwindcss(), pwa(), { name: "install-guide", configureServer: installGuide, configurePreviewServer: installGuide }],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
