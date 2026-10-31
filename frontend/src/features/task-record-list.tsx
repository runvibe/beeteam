import { useRef, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import type { Filters, Resources } from "@/api/types";
import { useInfiniteScroll } from "@/components/use-infinite-scroll";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure, NoData } from "@/components/shared";
import "./task-record-list.css";

export function TaskRecordList<
  K extends "tasks" | "attachments" | "timeline" | "summaries",
>({
  resource,
  scope,
  filters,
  empty,
  emptyDescription,
  children,
}: {
  resource: K;
  scope: string;
  filters: Filters;
  empty: string;
  emptyDescription?: string;
  children: (row: Resources[K]) => ReactNode;
}) {
  const api = useApi();
  const sentinel = useRef<HTMLDivElement>(null);
  const identity = JSON.stringify([resource, scope, filters]);
  const query = useInfiniteQuery({
    queryKey: [resource, scope, "task-infinite", filters],
    // Old paginated links must not hide rows now that there is no previous-page control.
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.list(resource, scope, { ...filters, offset: pageParam }, signal),
    getNextPageParam: (last, pages) =>
      nextPageOffset(last, pages, (row) => row.id),
  });
  const rows = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((row) => [row.id, row]) ?? [],
    ).values(),
  ];
  useInfiniteScroll({
    sentinel,
    getRoot: () =>
      window.matchMedia?.("(min-width: 1056px)").matches
        ? (sentinel.current?.closest("[data-detail-scroll]") ?? null)
        : null,
    identity,
    progress: `${query.dataUpdatedAt}:${rows.map((row) => row.id).join(",")}`,
    hasMore: !!query.hasNextPage,
    fetching: query.isFetching,
    error: query.error,
    loadMore: () => query.fetchNextPage({ cancelRefetch: false }),
  });
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} data-task-list-row={row.id}>
          {children(row)}
        </div>
      ))}
      {!query.isPending && !query.error && !rows.length && (
        <NoData title={empty} description={emptyDescription} />
      )}
      <div
        ref={sentinel}
        className="task-record-sentinel"
        data-task-record-sentinel={resource}
      >
        {(query.isPending || query.isFetchingNextPage) && (
          <LoadingIndicator label="Carregando registros" />
        )}
      </div>
      {query.error && (
        <Failure
          error={query.error}
          retry={() =>
            void (query.isFetchNextPageError
              ? query.fetchNextPage({ cancelRefetch: false })
              : query.refetch())
          }
        />
      )}
    </>
  );
}
