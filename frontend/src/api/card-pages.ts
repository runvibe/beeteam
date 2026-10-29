import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useApi } from "./context";
import type { Filters, Resources } from "./types";
import { currentUrl, navigate, useLocation } from "@/routing/location";

type CardResource = "boards" | "agents" | "teams";
type Block = { offset: number; limit: number };
const cap = (value: number) => Math.max(1, Math.min(100, Math.floor(value)));
function initialCapacity() {
  const columns =
    innerWidth <= 850 ? 1 : Math.max(1, Math.floor((innerWidth - 106) / 294));
  return cap(columns * Math.max(1, Math.ceil((innerHeight - 160) / 354)));
}
function readWindow(raw: string | null, fallback: Block): Block[] {
  if (!raw) return [fallback];
  const blocks = raw
    .split(",")
    .slice(-5)
    .map((part) => {
      const [offset, limit] = part.split(":").map(Number);
      return { offset, limit };
    });
  return blocks.length &&
    blocks[0].offset === fallback.offset &&
    blocks.every(
      (block, index) =>
        Number.isSafeInteger(block.offset) &&
        block.offset >= 0 &&
        block.offset <= 1000000 &&
        Number.isSafeInteger(block.limit) &&
        block.limit >= 1 &&
        block.limit <= 100 &&
        (!index || block.offset > blocks[index - 1].offset),
    )
    ? blocks
    : [fallback];
}
/** URL stores up to five exact offset:limit blocks; resize only affects the next fetch. */
export function useCardPages<K extends CardResource>(
  resource: K,
  filters: Filters,
) {
  const api = useApi();
  const url = useLocation();
  const params = new URLSearchParams(url.split("?")[1]);
  const explicitLimit = params.has(`${resource}.limit`)
    ? filters.limit
    : undefined;
  const [capacity, setCapacity] = useState(initialCapacity);
  const { offset: _offset, limit: _limit, ...identityFilters } = filters;
  const identity = JSON.stringify([resource, identityFilters, explicitLimit]);
  const [first, setFirst] = useState({
    identity,
    limit: explicitLimit ?? capacity,
  });
  if (first.identity !== identity)
    setFirst({ identity, limit: explicitLimit ?? capacity });
  const blocks = readWindow(params.get(`${resource}.window`), {
    offset: filters.offset ?? 0,
    limit:
      first.identity === identity ? first.limit : (explicitLimit ?? capacity),
  });
  const pages = useQueries({
    queries: blocks.map((block) => ({
      queryKey: [resource, "", { ...filters, ...block }],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.list(resource, "", { ...filters, ...block }, signal),
    })),
  });
  const records = new Map<string, Resources[K]>();
  for (const page of pages)
    for (const item of page.data?.items ?? []) records.set(item.id, item);
  const tail = pages[pages.length - 1];
  const fetching = pages.some((page) => page.isFetching);
  const error = pages.find((page) => page.error)?.error;
  const nextOffset = tail.data?.nextOffset;
  const hasMore = tail.data
    ? !!tail.data.hasMore &&
      nextOffset != null &&
      nextOffset > blocks[blocks.length - 1].offset
    : blocks.length > 1 && !!pages[pages.length - 2].data?.hasMore;
  const loadMore = () => {
    if (!hasMore || fetching || error || nextOffset == null) return;
    const [path, query] = currentUrl().split("?");
    const latest = new URLSearchParams(query);
    const next = [
      ...blocks,
      { offset: nextOffset, limit: cap(explicitLimit ?? capacity) },
    ].slice(-5);
    if (next[0].offset)
      latest.set(`${resource}.offset`, String(next[0].offset));
    else latest.delete(`${resource}.offset`);
    latest.set(
      `${resource}.window`,
      next.map((block) => `${block.offset}:${block.limit}`).join(","),
    );
    navigate(`${path}?${latest}`, true);
  };
  return {
    items: [...records.values()],
    total:
      tail.data?.total ?? pages.find((page) => page.data)?.data?.total ?? 0,
    start: blocks[0].offset,
    hasMore,
    fetching,
    error,
    initialLoading: pages.every((page) => !page.data) && fetching,
    loadMore,
    setCapacity: (value: number) => setCapacity(cap(value)),
    retry: () =>
      Promise.all(
        pages.filter((page) => page.error).map((page) => page.refetch()),
      ),
    identity,
  };
}
