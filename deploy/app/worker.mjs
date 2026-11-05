// Routes belong only to the hosted PWA; the API remains on the user's machine.
const navigation = /^\/app\/(?:$|(?:home|boards|tasks|teams|agents|settings)(?:\/[^.]*)?\/?$)/;
export default {
  async fetch(request, env) {
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/app") {
      url.pathname = "/app/";
      return Response.redirect(url, 308);
    }
    if (!path.startsWith("/app/") || path.split("/").some((part) => part.startsWith(".beeteam-")) || /^\/app\/(api|mcp|health|openapi)(\/|$)/.test(path))
      return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404 && navigation.test(path))
      response = await env.ASSETS.fetch(new Request(new URL("/app/index.html", url), request));
    const headers = new Headers(response.headers);
    const immutable = /^\/app\/assets\/.+-[\w-]{8,}\.[\w.]+$/.test(path);
    headers.set("Cache-Control", response.status === 404 ? "no-store" : immutable ? "public, max-age=31536000, immutable" : "no-cache");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
  },
};
