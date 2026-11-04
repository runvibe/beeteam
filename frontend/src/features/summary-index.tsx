import { FilterPopover, FilterOptions } from "@/components/filter-controls";
import { useRef, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import type { Resources, Filters } from "@/api/types";
import { eventTitle } from "./timeline-labels";
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

function useSummaryPages(
  taskId: string,
  resource: "summaries" | "timeline",
  filters: Filters,
) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: [resource, taskId, "index", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.list(
        resource,
        taskId,
        { ...filters, offset: pageParam, limit: 20 },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      nextPageOffset(last, pages, (row) => row.id),
  });
}

export function SummaryBrowser({
  taskId,
  progress,
  children,
  resource = "summaries",
  filters = {},
  filterControls,
  filtersActive = false,
  clearFilters,
}: {
  taskId: string;
  progress: Pick<ProgressPoint, "summaryId" | "percent">[];
  children: ReactNode;
  resource?: "summaries" | "timeline";
  filters?: Filters;
  filterControls?: ReactNode;
  filtersActive?: boolean;
  clearFilters?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useUrlState<string>(
    `${resource}.selected`,
    "",
  );
  const query = useSummaryPages(taskId, resource, filters);
  const noun = resource === "timeline" ? "Evento" : "Resumo";
  const plural = resource === "timeline" ? "eventos" : "resumos";
  const rowTitle = (row: Resources["summaries"] | Resources["timeline"]) =>
    "summary" in row ? summaryTitle(row) : eventTitle(row);
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
    label: rowTitle(row),
  }));
  if (selected && !options.some((option) => option.value === selected))
    options.unshift({ value: selected, label: `${noun} selecionado` });
  // Only explicit summary IDs establish a progress link. Missing feed coverage stays unknown.
  const percents = new Map(
    progress
      .filter((point) => point.summaryId)
      .map((point) => [point.summaryId, point.percent]),
  );
  return (
    <>
      <TaskFilters active={!!selected || filtersActive}>
        <FilterBar
          active={!!selected || filtersActive}
          onClear={() => {
            setSelected("");
            clearFilters?.();
          }}
        >
          {filterControls}
          <FilterPopover
            label={noun}
            active={!!selected}
            summary={
              options.find((option) => option.value === selected)?.label ??
              `Todos os ${plural}`
            }
            onClear={() => setSelected("")}
          >
            <SummaryFilterOptions
              taskId={taskId}
              resource={resource}
              filters={filters}
              selected={selected}
              onSelect={setSelected}
              options={options}
            />
          </FilterPopover>
        </FilterBar>
      </TaskFilters>
      <div className="summary-index-layout">
        <aside className="summary-index" aria-label={`Índice dos ${plural}`}>
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
                  <span className="summary-index-title">{rowTitle(row)}</span>
                  {resource === "summaries" && (
                    <RecordedProgress
                      percent={percent}
                      label="Progresso vinculado ao resumo"
                    />
                  )}
                  <span className="small-note">
                    {"occurredAt" in row
                      ? formatDate(row.occurredAt)
                      : percent === undefined
                        ? "Sem progresso vinculado"
                        : `${percent}%`}
                  </span>
                </button>
              );
            })}
            <div ref={sentinel} className="summary-index-sentinel">
              {(query.isPending || query.isFetchingNextPage) && (
                <LoadingIndicator label={`Carregando índice de ${plural}`} />
              )}
            </div>
            {!query.isPending && !query.error && !rows.length && (
              <NoData title={`Nenhum ${noun.toLowerCase()} registrado`} />
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
  resource,
  filters,
}: {
  taskId: string;
  selected: string;
  onSelect: (value: string) => void;
  options: { value: string; label: string }[];
  resource: "summaries" | "timeline";
  filters: Filters;
}) {
  const query = useSummaryPages(taskId, resource, filters);
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
        label={resource === "timeline" ? "Evento" : "Resumo"}
        value={selected}
        onChange={onSelect}
        options={options}
        all={resource === "timeline" ? "Todos os eventos" : "Todos os resumos"}
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
