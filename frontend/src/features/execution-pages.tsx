import { useLocale, t as tr } from "@/i18n";

import { ApiError } from "@/api/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/shared";
type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
};
export function ExecutionPages<T extends { id: string }>({
  queryKey,
  fetchPage,
  label,
  showCount = true,
  countLabel,
  children,
}: {
  queryKey: (string | number)[];
  fetchPage: (offset: number, signal: AbortSignal) => Promise<Page<T>>;
  label: string;
  showCount?: boolean;
  countLabel?: (count: number) => string;
  children: (rows: T[], loading: boolean, failed: boolean) => ReactNode;
}) {
  useLocale();
  const q = useInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    getNextPageParam: (page) =>
      page.hasMore && page.nextOffset !== null && page.nextOffset > page.offset
        ? page.nextOffset
        : undefined,
  });
  const rows = [
    ...new Map(
      (q.data?.pages.flatMap((page) => page.items) ?? []).map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  ];
  return (
    <section className="execution-records">
      {q.isPending && (
        <p role="status">{tr("common.loadingCollection", { label })}</p>
      )}
      {q.error &&
        (q.error instanceof ApiError && q.error.status === 501 ? (
          <p className="small-note">{q.error.message}</p>
        ) : (
          <Failure
            error={q.error}
            retry={() =>
              void (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())
            }
          />
        ))}
      {showCount && q.data && (
        <p className="small-note">
          {tr("common.loadedCollection", {
            shown: rows.length,
            total: q.data.pages[0].total,
            label: countLabel?.(q.data.pages[0].total) ?? label,
          })}
        </p>
      )}
      {q.hasNextPage && (
        <p className="small-note">
          {tr(
            "execution.partialHistoryLoadedRecordsOnlyGlobalTotalsAreIndependentOf",
          )}
        </p>
      )}
      {children(rows, q.isPending, !!q.error && !q.data)}
      {q.hasNextPage && (
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void q.fetchNextPage()}
        >
          {tr("common.loadMoreCollection", { label })}
        </Button>
      )}
    </section>
  );
}
