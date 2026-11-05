import topics from "../src/topics.json";
export function route(ctx: { urlPathname: string }) {
  const path = ctx.urlPathname.replace(/^\/pt(?=\/|$)/, "") || "/";
  const topic = path.replace(/^\/guide\/?/, "").replace(/\/$/, "") || "about";
  return path === "/" ||
    path === "/guide/" ||
    path === "/guide" ||
    (path.startsWith("/guide/") && topics.includes(topic))
    ? { routeParams: {} }
    : false;
}
