import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../deploy/site/worker.mjs";
const root = resolve(
  fileURLToPath(new URL("../.local/site-candidate", import.meta.url)),
);
const port = Number(process.env.PORT ?? process.argv[2] ?? 5177);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid preview port");
const types = {
  html: "text/html; charset=utf-8",
  js: "text/javascript",
  css: "text/css",
  json: "application/json",
  webmanifest: "application/manifest+json",
  svg: "image/svg+xml",
  png: "image/png",
  woff2: "font/woff2",
  xml: "application/xml",
  txt: "text/plain",
};
const env = {
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      let name;
      try {
        name = decodeURIComponent(url.pathname);
      } catch {
        return new Response(null, { status: 400 });
      }
      const path = resolve(root, "." + name);
      if (path !== root && !path.startsWith(root + sep))
        return new Response(null, { status: 404 });
      try {
        if (!(await stat(path)).isFile())
          return new Response(null, { status: 404 });
        return new Response(await readFile(path), {
          headers: {
            "Content-Type":
              types[path.split(".").at(-1)] ?? "application/octet-stream",
          },
        });
      } catch (error) {
        if (["ENOENT", "EISDIR", "ENOTDIR"].includes(error.code))
          return new Response(null, { status: 404 });
        throw error;
      }
    },
  },
};
createServer(async (req, res) => {
  try {
    const response = await worker.fetch(
      new Request(new URL(req.url, "http://127.0.0.1:" + port), {
        method: req.method,
      }),
      env,
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end();
  }
}).listen(port, "127.0.0.1", () =>
  console.log("Composed Bee Team preview http://127.0.0.1:" + port),
);
