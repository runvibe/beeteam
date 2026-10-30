import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { PlanRevision } from "@/api/types";
import { usePageSize } from "@/routing/query";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure, NoData } from "@/components/shared";
import { Button } from "@/components/ui/button";
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
    queryFn: ({ pageParam }) =>
      api.revisions(item.taskId, item.planId, { offset: pageParam, limit }),
    getNextPageParam: (last) =>
      last.hasMore && last.nextOffset !== null && last.nextOffset > last.offset
        ? last.nextOffset
        : undefined,
  });
  const { hasNextPage, isFetching, error, fetchNextPage } = q;
  useEffect(() => {
    const target = sentinel.current;
    if (
      !target ||
      !hasNextPage ||
      isFetching ||
      error ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const media = window.matchMedia("(min-width: 1056px)");
    let observer: IntersectionObserver;
    const observe = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting))
            void fetchNextPage({ cancelRefetch: false });
        },
        {
          root: media.matches ? target.closest("[data-detail-scroll]") : null,
          rootMargin: "0px 0px 240px 0px",
        },
      );
      observer.observe(target);
    };
    observe();
    media.addEventListener("change", observe);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", observe);
    };
  }, [hasNextPage, isFetching, error, fetchNextPage]);
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
          {p.changeSummary && <p>{p.changeSummary}</p>}
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
      <div ref={sentinel} data-history-sentinel style={{ minHeight: 1 }}>
        {isFetching && (
          <LoadingIndicator label="Carregando histórico de alterações" />
        )}
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
      </div>
    </section>
  );
}
