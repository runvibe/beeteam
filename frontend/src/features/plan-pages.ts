import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { usePageSize } from "@/routing/query";

export function usePlanPages(taskId: string) {
  const api = useApi();
  const limit = usePageSize("plans", 10);
  const query = useInfiniteQuery({
    queryKey: ["plans", taskId, "navigation", limit],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.list("plans", taskId, { offset: pageParam, limit }, signal),
    getNextPageParam: (last) =>
      last.hasMore && last.nextOffset !== null && last.nextOffset > last.offset
        ? last.nextOffset
        : undefined,
  });
  const items = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.planId, item]) ?? [],
    ).values(),
  ];
  const loadMore = () =>
    query.hasNextPage && !query.isFetching && !query.error
      ? query.fetchNextPage({ cancelRefetch: false })
      : undefined;
  const retry = () =>
    query.isFetchNextPageError
      ? query.fetchNextPage({ cancelRefetch: false })
      : query.refetch();
  return { query, items, loadMore, retry };
}
