import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import {
  currentUrl,
  useLocation,
  replaceCanonicalUrl,
  safeOrigin,
} from "./location";
import { canonicalUrl } from "./canonical-url";
export type SlugResource = "agents" | "teams" | "tasks";
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function useRouteEntity() {
  const url = useLocation();
  const [, kind, key] = url.split("?")[0].split("/");
  const resource = (
    ["agents", "teams", "tasks"].includes(kind) ? kind : null
  ) as SlugResource | null;
  const api = useApi(),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ["route-entity", resource, key],
    enabled: !!resource && !!key,
    queryFn: async () => {
      const id = isUuid(key) ? key : (await api.resolveSlug(resource!, key)).id;
      return api.get(resource!, id);
    },
  });
  useEffect(() => {
    if (!resource || !key || !query.data) return;
    client.setQueryData([resource, query.data.id], query.data);
    client.setQueryData(
      ["route-entity", resource, query.data.slug],
      query.data,
    );
    let cancelled = false;
    const entity = query.data;
    void (async () => {
      let next = canonicalUrl(url, resource, key, entity.slug);
      let origin = safeOrigin(
        new URLSearchParams(url.split("?")[1]).get("from"),
      );
      while (origin) {
        const [, kind, id] = origin.split("?")[0].split("/");
        if (["agents", "teams", "tasks"].includes(kind) && isUuid(id ?? "")) {
          try {
            const row = await client.ensureQueryData({
              queryKey: [kind, id],
              queryFn: () => api.get(kind as SlugResource, id),
            });
            next = canonicalUrl(next, kind as SlugResource, id, row.slug);
          } catch {
            /* Preserve unavailable origins; their own route displays the error. */
          }
        }
        origin = safeOrigin(
          new URLSearchParams(origin.split("?")[1]).get("from"),
        );
      }
      if (!cancelled && currentUrl() === url) replaceCanonicalUrl(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [resource, key, query.data, client, api, url]);
  return { ...query, active: !!resource && !!key };
}
