import { nextPageOffset } from "@/api/page-continuation";
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "./context";
import type { BoardView, Filters, Task } from "./types";

export function useColumnPages(
  boardId: string,
  column: BoardView["columns"][number],
  filters: Filters,
) {
  const api = useApi();
  const { limitPerColumn, ...continuation } = filters;
  const limit = Math.max(6, Math.min(100, limitPerColumn ?? 6));
  const query = useInfiniteQuery({
    queryKey: ["column", boardId, column.status.id, continuation, limit],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.list(
        "tasks",
        boardId,
        {
          ...continuation,
          statusId: column.status.id,
          archived: false,
          sortBy: "position",
          sortOrder: "asc",
          offset: pageParam,
          limit,
        },
        signal,
      ),
    initialData: {
      pages: [
        {
          items: column.tasks,
          offset: 0,
          limit: column.limit,
          total: column.total,
          hasMore: column.hasMore,
          nextOffset: column.nextOffset,
        },
      ],
      pageParams: [0],
    },
    getNextPageParam: (last, pages) =>
      nextPageOffset(last, pages, (item) => item.id),
  });
  const items = useMemo(() => {
    const unique = new Map<string, Task>();
    for (const page of query.data.pages)
      for (const task of page.items) unique.set(task.id, task);
    return [...unique.values()];
  }, [query.data]);
  return {
    items,
    total: query.data.pages[0].total,
    hasMore: query.hasNextPage,
    fetching: query.isFetching,
    error: query.error,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetching && !query.error)
        void query.fetchNextPage({ cancelRefetch: false });
    },
    retry: () =>
      query.isFetchNextPageError
        ? query.fetchNextPage({ cancelRefetch: false })
        : query.refetch(),
  };
}
