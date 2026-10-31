import { nextPageOffset } from "@/api/page-continuation";
import { useInfiniteScroll } from "@/components/use-infinite-scroll";
import { useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { PlanRevision } from "@/api/types";
import { usePageSize } from "@/routing/query";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure, NoData } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { Metadata } from "./plan-metadata";

export function PlanHistory({
  item,
  onSelect,
}: {
  item: PlanRevision;
  onSelect: (revision: number) => void;
}) {
  const api = useApi();
  const limit = usePageSize(`revision.${item.planId}`, 5);
  const sentinel = useRef<HTMLDivElement>(null);
  const q = useInfiniteQuery({
    queryKey: [
      "revisions",
      item.taskId,
      item.planId,
      "history",
      limit,
      item.revision,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.revisions(
        item.taskId,
        item.planId,
        { offset: pageParam, limit },
        signal,
      ),
    getNextPageParam: (last, pages) =>
      nextPageOffset(last, pages, (item) => item.id),
  });
  const { hasNextPage, isFetching, error, fetchNextPage } = q;
  useInfiniteScroll({
    sentinel,
    getRoot: () =>
      sentinel.current?.closest("[data-plan-scroll]") ??
      (window.matchMedia?.("(min-width: 1056px)").matches
        ? (sentinel.current?.closest("[data-detail-scroll]") ?? null)
        : null),
    identity: item.planId,
    progress:
      q.data?.pages
        .flatMap((page) => page.items.map((record) => record.id))
        .join(",") ?? "",
    hasMore: !!hasNextPage,
    fetching: isFetching,
    error,
    margin: 240,
    loadMore: () => fetchNextPage({ cancelRefetch: false }),
  });
  const records = [
    ...new Map(
      q.data?.pages
        .flatMap((page) => page.items)
        .map((record) => [record.id, record]) ?? [],
    ).values(),
  ];
  return (
    <section
      className="task-plan-history task-reading-block"
      aria-label="Histórico de alterações"
    >
      <h3>Histórico de alterações</h3>
      {records.map((p) => (
        <div className="record" key={p.id}>
          <h4>
            Revisão {p.revision}
            {p.revision === item.revision ? " · atual" : ""}
          </h4>
          <Metadata item={p} />
          {p.changeSummary && (
            <Markdown headingOffset={2}>{p.changeSummary}</Markdown>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              onSelect(p.revision === item.revision ? 0 : p.revision)
            }
          >
            Ver revisão {p.revision}
          </Button>
        </div>
      ))}
      {!q.isPending && !error && !records.length && (
        <NoData title="Nenhuma revisão registrada" />
      )}
      <div ref={sentinel} data-history-sentinel>
        {isFetching && (
          <LoadingIndicator label="Carregando histórico de alterações" />
        )}
      </div>
      {error && (
        <Failure
          error={error}
          retry={() =>
            void (q.isFetchNextPageError
              ? fetchNextPage({ cancelRefetch: false })
              : q.refetch())
          }
        />
      )}
    </section>
  );
}
