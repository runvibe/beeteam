import { safeOrigin } from "./location";
/** Rewrite navigation only. UUID query values used by API filters are untouched. */
export function canonicalUrl(
  url: string,
  resource: "agents" | "teams" | "tasks",
  oldKey: string,
  slug: string,
): string {
  const [path, query] = url.split("?");
  const parts = path.split("/");
  if (parts[1] === resource && parts[2] === oldKey)
    parts[2] = encodeURIComponent(slug);
  const params = new URLSearchParams(query);
  const from = safeOrigin(params.get("from"));
  if (from) {
    const next = canonicalUrl(from, resource, oldKey, slug);
    if (next !== from) params.set("from", next);
  }
  return parts.join("/") + (params.size ? `?${params}` : "");
}
