import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

/** Public SSG pages coexist with the app's live /app/ development entry. */
export function publicSite(): Plugin {
  function attach(server: ViteDevServer | PreviewServer) {
    const directory = resolve(server.config.root, "../site/dist/client");
    server.middlewares.use((req, res, next) => {
      if (!["GET", "HEAD"].includes(req.method ?? "")) return next();
      let path: string;
      try { path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname); }
      catch { return next(); }
      if (/^\/(?:app|api|mcp|docs|openapi|health)(?:\/|$)/.test(path)) return next();
      const publicPage = path === "/" || /^\/(?:pt|guide)(?:\/|$)/.test(path) || /^\/install\/?$/.test(path);
      const file = resolve(directory, "." + path);
      if (!file.startsWith(directory + sep) && file !== directory) return next();
      const html = resolve(file, "index.html");
      const selected = existsSync(file) && statSync(file).isFile() ? file : existsSync(html) ? html : null;
      if (!selected) {
        if (!publicPage) return next();
        res.statusCode = 503;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Build the public site first: npm --prefix site run build");
        return;
      }
      const ext = selected.split(".").pop() ?? "";
      const types: Record<string,string> = {html:"text/html; charset=utf-8",js:"text/javascript",css:"text/css",json:"application/json",svg:"image/svg+xml",png:"image/png",woff2:"font/woff2",xml:"application/xml",txt:"text/plain"};
      res.setHeader("Content-Type", types[ext] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.end(req.method === "HEAD" ? undefined : readFileSync(selected));
    });
  }
  return { name: "public-site-preview", configureServer: attach, configurePreviewServer: attach };
}
