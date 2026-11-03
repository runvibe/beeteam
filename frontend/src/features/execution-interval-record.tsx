import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TaskExecutionInterval } from "@/api/generated/kanban/TaskExecutionInterval";
import { useApi } from "@/api/context";
import { Button } from "@/components/ui/button";
import { Failure } from "@/components/shared";
import { ExecutionPages } from "./execution-pages";
import { ExecutionIntervalDetail } from "./execution-interval-detail";
import { OverviewAttribution } from "./overview-artifacts";
export function ExecutionIntervalRecord({
  interval,
}: {
  interval: TaskExecutionInterval;
}) {
  const api = useApi();
  const [revisions, setRevisions] = useState(false);
  return (
    <article className="execution-interval-record">
      <ExecutionIntervalDetail interval={interval} />
      <Button
        variant="outline"
        aria-expanded={revisions}
        onClick={() => setRevisions(!revisions)}
      >
        Histórico de revisões
      </Button>
      {revisions && (
        <ExecutionPages
          queryKey={[
            "execution-interval-revisions",
            interval.taskId,
            interval.id,
            interval.version,
          ]}
          fetchPage={(offset, signal) =>
            api.executionIntervalRevisions(
              interval.taskId,
              interval.id,
              { offset, limit: 20 },
              signal,
            )
          }
          label="revisões"
        >
          {(rows, loading, failed) => (
            <>
              {!loading && !failed && !rows.length && (
                <p>Nenhuma revisão anterior registrada.</p>
              )}
              {rows.map((row) => (
                <details key={row.id}>
                  <summary>
                    Revisão anterior {row.revision} · {row.reason}
                  </summary>
                  <OverviewAttribution
                    actor={row.reportingActor}
                    date={row.createdAt}
                  />
                  <ExecutionIntervalDetail interval={row.interval} />
                </details>
              ))}
            </>
          )}
        </ExecutionPages>
      )}
    </article>
  );
}
export function ExecutionIntervalLookup({
  taskId,
  intervalId,
  version,
}: {
  taskId: string;
  intervalId: string;
  version: number;
}) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    host.current?.focus();
    host.current?.scrollIntoView?.({ block: "start" });
  }, [intervalId]);
  const api = useApi();
  const q = useQuery({
    queryKey: ["execution-interval-by-id", taskId, intervalId, version],
    queryFn: async ({ signal }) => {
      let offset = 0;
      for (;;) {
        const page = await api.executionIntervals(
          taskId,
          { offset, limit: 100 },
          signal,
        );
        const match = page.items.find((row) => row.id === intervalId);
        if (match) return match;
        if (
          !page.hasMore ||
          page.nextOffset === null ||
          page.nextOffset <= offset
        )
          break;
        offset = page.nextOffset;
      }
      throw new Error(
        "Intervalo referenciado não encontrado nos registros disponíveis.",
      );
    },
  });
  return (
    <section ref={host} tabIndex={-1} aria-label="Intervalo selecionado">
      {q.isPending && <p role="status">Carregando intervalo…</p>}
      {q.error && <Failure error={q.error} retry={() => void q.refetch()} />}
      {q.data && <ExecutionIntervalRecord interval={q.data} />}
    </section>
  );
}
