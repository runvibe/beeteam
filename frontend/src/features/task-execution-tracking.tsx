import { useUrlState } from "@/routing/query";
import { Popover } from "radix-ui";
import { eventLabels } from "./timeline-labels";
import { TimelineEventPreview } from "./timeline-event-preview";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/api/types";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Failure } from "@/components/shared";
import { IntervalMetrics } from "./interval-metrics";
import { ExecutionTimeline } from "./execution-timeline";
import { TimelinePointPages } from "./timeline-point-pages";
import "./task-execution-tracking.css";
const coverageLabels = {
  totalIntervals: "intervalos",
  validIntervals: "válidos",
  openIntervals: "abertos",
  incompleteIntervals: "incompletos",
  invalidIntervals: "inválidos",
  untrackedSummaries: "resumos sem rastreamento",
};
export function TaskExecutionTracking({
  taskId,
  version,
}: {
  taskId: string;
  version: number;
}) {
  const api = useApi();
  const q = useQuery({
    queryKey: ["execution-interval-usage", taskId, version],
    queryFn: ({ signal }) => api.executionIntervalUsage(taskId, signal),
  });
  const data = q.data;
  return (
    <section className="task-execution-tracking">
      {q.isPending && <p role="status">Carregando consumo por intervalos…</p>}
      {q.error &&
        (q.error instanceof ApiError && q.error.status === 501 ? (
          <p className="small-note">{q.error.message}</p>
        ) : (
          <Failure error={q.error} retry={() => void q.refetch()} />
        ))}
      <IntervalMetrics
        data={
          data
            ? {
                tokens: data.validTotalTokens,
                observedMs: data.observedDurationMs,
                elapsedMs: data.elapsedDurationMs,
                coverage: Object.entries(coverageLabels).map(
                  ([key, label]) => ({
                    label,
                    count: data.coverage[key as keyof typeof data.coverage],
                  }),
                ),
              }
            : undefined
        }
      />
    </section>
  );
}

export function TaskExecutionTimeline({
  taskId,
  version,
}: {
  taskId: string;
  version: number;
}) {
  const api = useApi();
  const [, setSelected] = useUrlState<string>("timeline.selected", "");
  return (
    <section className="task-execution-timeline">
      <TimelinePointPages
        taskId={taskId}
        version={version}
        fetchPage={(offset, signal) =>
          api.timelinePoints(
            taskId,
            {
              offset,
              limit: 100,
            },
            signal,
          )
        }
      >
        {(rows, loading, failed) => (
          <ExecutionTimeline
            description="Eventos da tarefa na ordem de registro. Selecione um ponto para abrir seu evento. O espaçamento não representa duração."
            events={rows.map((row) => ({
              ...row,
              label: eventLabels[row.type] ?? row.type,
              occurredAt: row.occurredAt,
            }))}
            emptyMessage={
              loading
                ? "Carregando eventos…"
                : failed
                  ? "Histórico de execução indisponível."
                  : undefined
            }
            renderDetail={(event) => (
              <div className="execution-event-detail">
                <TimelineEventPreview event={event} />
                <Popover.Close asChild>
                  <Button
                    variant="outline"
                    onClick={() => setSelected(event.id)}
                  >
                    Ver evento
                  </Button>
                </Popover.Close>
              </div>
            )}
          />
        )}
      </TimelinePointPages>
    </section>
  );
}
