import { useLocale, t as tr } from "@/i18n";

import { useUrlState } from "@/routing/query";
import { useRef, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import type { Filters, Resources } from "@/api/types";
import { useInfiniteScroll } from "@/components/use-infinite-scroll";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure, NoData } from "@/components/shared";
import "./task-record-list.css";

export function DetailRecordList<
  K extends
    | "tasks"
    | "attachments"
    | "timeline"
    | "summaries"
    | "activities"
    | "chats"
    | "members"
    | "boards",
>({
  resource,
  scope,
  filters,
  empty,
  emptyDescription,
  countLabel,
  children,
}: {
  resource: K;
  scope: string;
  filters: Filters;
  empty: string;
  emptyDescription?: string;
  countLabel?: string;
  children: (row: Resources[K]) => ReactNode;
}) {
  useLocale();
  const api = useApi();
  const [selected] = useUrlState(`${resource}.selected`, "");
  const target =
    resource === "summaries" || resource === "timeline" ? selected : "";
  const { offset: _offset, ...pageFilters } = filters;
  const effectiveFilters = target
    ? { ...pageFilters, id: target }
    : pageFilters;
  const key = (row: Resources[K]) =>
    "taskId" in row && resource === "activities"
      ? String(row.taskId)
      : "agentId" in row && resource === "members"
        ? String(row.agentId)
        : String((row as { id: string }).id);
  const sentinel = useRef<HTMLDivElement>(null);
  const identity = JSON.stringify([resource, scope, effectiveFilters]);
  const query = useInfiniteQuery({
    queryKey: [resource, scope, "task-infinite", effectiveFilters],
    // Old paginated links must not hide rows now that there is no previous-page control.
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.list(
        resource,
        scope,
        { ...effectiveFilters, offset: pageParam },
        signal,
      ),
    getNextPageParam: (last, pages) => nextPageOffset(last, pages, key),
  });
  const rows = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((row) => [key(row), row]) ?? [],
    ).values(),
  ];
  useInfiniteScroll({
    sentinel,
    getRoot: () =>
      sentinel.current?.closest("[data-list-scroll]") ??
      (window.matchMedia?.("(min-width: 1056px)").matches
        ? (sentinel.current?.closest("[data-detail-scroll]") ?? null)
        : null),
    identity,
    progress: `${query.dataUpdatedAt}:${rows.map(key).join(",")}`,
    hasMore: !!query.hasNextPage,
    fetching: query.isFetching,
    error: query.error,
    loadMore: () => query.fetchNextPage({ cancelRefetch: false }),
  });
  return (
    <div>
      {countLabel && query.data && (
        <p className="small-note">
          {tr("common.loadedCollection", {
            shown: rows.length,
            total: query.data.pages[0].total,
            label: countLabel,
          })}
        </p>
      )}
      {rows.map((row) => (
        <div
          key={key(row)}
          id={`${resource}-${key(row)}`}
          tabIndex={-1}
          data-task-list-row={key(row)}
          className={target === key(row) ? "task-record-selected" : undefined}
        >
          {children(row)}
        </div>
      ))}
      {target &&
        !query.isPending &&
        !query.error &&
        !query.hasNextPage &&
        !rows.some((row) => key(row) === target) && (
          <p role="status">
            {resource === "timeline"
              ? tr("tasks.eventNotFoundInThisScope")
              : tr("tasks.summaryNotFoundInThisTask")}
          </p>
        )}
      {!target && !query.isPending && !query.error && !rows.length && (
        <NoData title={empty} description={emptyDescription} />
      )}
      <div
        ref={sentinel}
        className="task-record-sentinel"
        data-task-record-sentinel={resource}
      >
        {(query.isPending || query.isFetchingNextPage) && (
          <LoadingIndicator label={tr("tasks.loadingRecords")} />
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
    </div>
  );
}
