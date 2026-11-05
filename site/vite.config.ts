import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const local = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  plugins: [react(), tailwind(), vike()],
  publicDir: local("./public"),
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react-i18next",
      "i18next",
      "zustand",
      "@tanstack/react-query",
    ],
    alias: [
      { find: "@/i18n", replacement: local("./src/i18n.ts") },
      { find: "@/state/theme-runtime", replacement: local("./src/theme.ts") },
      { find: "@", replacement: local("./src") },
    ],
  },
  define: {
    __BEE_APP_VERSION__: JSON.stringify(
      readFileSync(local("../Cargo.toml"), "utf8").match(
        /^version\s*=\s*"([^"]+)"/m,
      )![1],
    ),
  },
  build: { assetsDir: "site-assets" },
});
