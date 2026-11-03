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
  children,
}: {
  queryKey: (string | number)[];
  fetchPage: (offset: number, signal: AbortSignal) => Promise<Page<T>>;
  label: string;
  showCount?: boolean;
  children: (rows: T[], loading: boolean, failed: boolean) => ReactNode;
}) {
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
      {q.isPending && <p role="status">Carregando {label}…</p>}
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
          {rows.length} de {q.data.pages[0].total} {label}
        </p>
      )}
      {q.hasNextPage && (
        <p className="small-note">
          Histórico parcial: apenas registros carregados. Totais globais
          independem desta página.
        </p>
      )}
      {children(rows, q.isPending, !!q.error && !q.data)}
      {q.hasNextPage && (
        <Button
          variant="outline"
          disabled={q.isFetching}
          onClick={() => void q.fetchNextPage()}
        >
          Carregar mais {label}
        </Button>
      )}
    </section>
  );
}
