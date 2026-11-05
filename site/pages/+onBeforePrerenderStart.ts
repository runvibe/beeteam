import topics from "../src/topics.json";
export function onBeforePrerenderStart() {
  return ["/", "/guide/", ...topics.map((p) => "/guide/" + p)].flatMap((p) => [
    p,
    "/pt" + p,
  ]);
}
