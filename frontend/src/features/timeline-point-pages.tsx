import { useEffect, useMemo, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Failure } from "@/components/shared";
import type { TimelinePoint, TimelinePointPage } from "@/api/timeline-points";
export type PointPage = TimelinePointPage;
export function inspectPointPages(pages: PointPage[]) {
  const rows: TimelinePoint[] = [],
    seen = new Set<string>();
  const total = pages[0]?.total;
  let lastSequence = -1;
  const invalid = () => ({
    rows,
    total,
    complete: false,
    nextOffset: undefined,
    error: new Error(
      "Não foi possível completar os pontos: paginação inconsistente ou histórico alterado. Tente novamente.",
    ),
  });
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index],
      count = rows.length + page.items.length;
    if (
      !Number.isSafeInteger(total) ||
      total! < 0 ||
      page.total !== total ||
      page.offset !== rows.length ||
      count > total! ||
      !Number.isInteger(page.limit) ||
      page.limit < 1 ||
      page.items.length > page.limit
    )
      return invalid();
    if (
      page.hasMore
        ? !page.items.length || count >= total! || page.nextOffset !== count
        : count !== total ||
          page.nextOffset !== null ||
          index !== pages.length - 1
    )
      return invalid();
    const pageIds = new Set<string>();
    let sequence = lastSequence;
    for (const row of page.items) {
      if (
        !row.id ||
        !row.taskId ||
        !Number.isSafeInteger(row.sequence) ||
        row.sequence <= sequence ||
        seen.has(row.id) ||
        pageIds.has(row.id)
      )
        return invalid();
      sequence = row.sequence;
      pageIds.add(row.id);
    }
    lastSequence = sequence;
    pageIds.forEach((id) => seen.add(id));
    rows.push(...page.items);
  }
  const last = pages.at(-1);
  return {
    rows,
    total,
    complete: !!last && !last.hasMore,
    nextOffset: last?.hasMore ? (last.nextOffset ?? undefined) : undefined,
    error: null,
  };
}
export function TimelinePointPages({
  taskId,
  version,
  fetchPage,
  children,
}: {
  taskId: string;
  version: number;
  fetchPage: (offset: number, signal: AbortSignal) => Promise<PointPage>;
  children: (
    rows: TimelinePoint[],
    loading: boolean,
    failed: boolean,
  ) => ReactNode;
}) {
  const q = useInfiniteQuery({
    queryKey: ["timeline-points", taskId, version],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    getNextPageParam: (_last, pages) => inspectPointPages(pages).nextOffset,
  });
  const state = useMemo(() => inspectPointPages(q.data?.pages ?? []), [q.data]);
  const error = q.error ?? state.error;
  useEffect(() => {
    if (q.hasNextPage && !q.isFetching && !error) void q.fetchNextPage();
  }, [q.hasNextPage, q.isFetching, error, q.fetchNextPage, state.nextOffset]);
  return (
    <section className="timeline-point-pages">
      {!state.complete && !error && (
        <p role="status">
          Carregando todos os pontos…
          {state.total !== undefined
            ? ` ${state.rows.length} de ${state.total}`
            : ""}
        </p>
      )}
      {state.rows.length > 0 && (!state.complete || error) && (
        <p className="small-note">
          Histórico parcial: {state.rows.length} pontos disponíveis nesta
          leitura. A carga completa ainda não foi confirmada.
        </p>
      )}
      {error && <Failure error={error} retry={() => void q.refetch()} />}
      {children(state.rows, q.isPending, !!error && !state.rows.length)}
    </section>
  );
}
