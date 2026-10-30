import { nextPageOffset } from "@/api/page-continuation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { usePageSize } from "@/routing/query";

export function usePlanPages(
  taskId: string,
  selected = "",
  locateSelected = false,
) {
  const api = useApi();
  const limit = usePageSize("plans", 10);
  const client = useQueryClient();
  const queryKey = useMemo(
    () => ["plans", taskId, "navigation", limit],
    [taskId, limit],
  );
  const owned = useRef<symbol | null>(null);
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.list("plans", taskId, { offset: pageParam, limit }, signal),
    getNextPageParam: (last, pages) =>
      nextPageOffset(last, pages, (item) => item.planId),
  });
  const items = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.planId, item]) ?? [],
    ).values(),
  ];
  const locating =
    locateSelected &&
    !!selected &&
    !items.some((item) => item.planId === selected) &&
    !!query.hasNextPage;
  useEffect(
    () => () => {
      if (owned.current) {
        owned.current = null;
        void client.cancelQueries({ queryKey, exact: true });
      }
    },
    [client, queryKey, selected],
  );
  const locateMore = useCallback(() => {
    if (!query.hasNextPage || query.isFetching || query.error) return;
    const token = Symbol();
    owned.current = token;
    return query
      .fetchNextPage({ cancelRefetch: false })
      .catch(() => undefined)
      .finally(() => {
        if (owned.current === token) owned.current = null;
      });
  }, [query.hasNextPage, query.isFetching, query.error, query.fetchNextPage]);
  useEffect(() => {
    if (locating) void locateMore();
  }, [locating, locateMore, query.data]);
  const loadMore = () =>
    query.hasNextPage && !query.isFetching && !query.error
      ? query.fetchNextPage({ cancelRefetch: false })
      : undefined;
  const retry = () =>
    query.isFetchNextPageError
      ? query.fetchNextPage({ cancelRefetch: false })
      : query.refetch();
  return { query, items, locating, locateMore, loadMore, retry };
}
