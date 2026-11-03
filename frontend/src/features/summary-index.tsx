import { FilterPopover, FilterOptions } from "@/components/filter-controls";
import { useRef, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import type { Resources } from "@/api/types";
import type { ProgressPoint } from "@/api/task-overview";
import { useUrlState } from "@/routing/query";
import { Failure, NoData, formatDate } from "@/components/shared";
import { FilterBar } from "@/components/filter-bar";
import { useInfiniteScroll } from "@/components/use-infinite-scroll";
import { LoadingIndicator } from "@/components/loading-indicator";
import {
  RecordedProgress,
  recordedPercent,
} from "@/components/recorded-progress";
import { TaskFilters } from "./task-filter-layout";
import "./summary-index.css";

export function summaryTitle(
  row: Pick<Resources["summaries"], "summary" | "createdAt">,
) {
  const line = row.summary
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  const title = line?.replace(/^#{1,6}\s+/, "");
  return title
    ? title.length > 100
      ? title.slice(0, 99) + "…"
      : title
    : `Resumo de ${formatDate(row.createdAt)}`;
}

function useSummaryPages(taskId: string) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["summaries", taskId, "index"],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.list("summaries", taskId, { offset: pageParam, limit: 20 }, signal),
    getNextPageParam: (last, pages) =>
      nextPageOffset(last, pages, (row) => row.id),
  });
}

export function SummaryBrowser({
  taskId,
  progress,
  children,
}: {
  taskId: string;
  progress: Pick<ProgressPoint, "summaryId" | "percent">[];
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useUrlState<string>("summaries.selected", "");
  const query = useSummaryPages(taskId);
  const rows = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((row) => [row.id, row]) ?? [],
    ).values(),
  ];
  useInfiniteScroll({
    sentinel,
    getRoot: () => root.current,
    identity: taskId,
    progress: `${query.dataUpdatedAt}:${rows.map((row) => row.id).join(",")}`,
    hasMore: !!query.hasNextPage,
    fetching: query.isFetching,
    error: query.error,
    loadMore: () => query.fetchNextPage({ cancelRefetch: false }),
  });
  const options = rows.map((row) => ({
    value: row.id,
    label: summaryTitle(row),
  }));
  if (selected && !options.some((option) => option.value === selected))
    options.unshift({ value: selected, label: "Resumo selecionado" });
  // Only explicit summary IDs establish a progress link. Missing feed coverage stays unknown.
  const percents = new Map(
    progress
      .filter((point) => point.summaryId)
      .map((point) => [point.summaryId, point.percent]),
  );
  return (
    <>
      <TaskFilters active={!!selected}>
        <FilterBar active={!!selected} onClear={() => setSelected("")}>
          <FilterPopover
            label="Resumo"
            active={!!selected}
            summary={
              options.find((option) => option.value === selected)?.label ??
              "Todos os resumos"
            }
            onClear={() => setSelected("")}
          >
            <SummaryFilterOptions
              taskId={taskId}
              selected={selected}
              onSelect={setSelected}
              options={options}
            />
          </FilterPopover>
        </FilterBar>
      </TaskFilters>
      <div className="summary-index-layout">
        <aside className="summary-index" aria-label="Índice dos resumos">
          <div className="summary-index-items" ref={root}>
            {rows.map((row) => {
              const percent = recordedPercent(percents.get(row.id));
              return (
                <button
                  key={row.id}
                  type="button"
                  className="summary-index-item"
                  aria-pressed={selected === row.id}
                  onClick={() => setSelected(row.id)}
                >
                  <span className="summary-index-title">
                    {summaryTitle(row)}
                  </span>
                  <RecordedProgress
                    percent={percent}
                    label="Progresso vinculado ao resumo"
                  />
                  <span className="small-note">
                    {percent === undefined
                      ? "Sem progresso vinculado"
                      : `${percent}%`}
                  </span>
                </button>
              );
            })}
            <div ref={sentinel} className="summary-index-sentinel">
              {(query.isPending || query.isFetchingNextPage) && (
                <LoadingIndicator label="Carregando índice de resumos" />
              )}
            </div>
            {!query.isPending && !query.error && !rows.length && (
              <NoData title="Nenhum resumo registrado" />
            )}
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
        </aside>
        {children}
      </div>
    </>
  );
}

function SummaryFilterOptions({
  taskId,
  selected,
  onSelect,
  options,
}: {
  taskId: string;
  selected: string;
  onSelect: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const query = useSummaryPages(taskId);
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  useInfiniteScroll({
    sentinel,
    getRoot: () => root.current,
    identity: taskId,
    progress: `${query.dataUpdatedAt}:${options.map((option) => option.value).join(",")}`,
    hasMore: !!query.hasNextPage,
    fetching: query.isFetching,
    error: query.error,
    loadMore: () => query.fetchNextPage({ cancelRefetch: false }),
  });
  return (
    <div className="summary-filter-options" ref={root}>
      <FilterOptions
        label="Resumo"
        value={selected}
        onChange={onSelect}
        options={options}
        all="Todos os resumos"
      />
      <div ref={sentinel} className="summary-index-sentinel">
        {(query.isPending || query.isFetchingNextPage) && (
          <LoadingIndicator label="Carregando resumos" />
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
