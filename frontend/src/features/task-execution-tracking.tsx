import { ApiError } from "@/api/types";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Failure } from "@/components/shared";
import { IntervalMetrics } from "./interval-metrics";
import { ExecutionTimeline } from "./execution-timeline";
import { ExecutionPages } from "./execution-pages";
import {
  ExecutionEventDetail,
  executionAction,
} from "./execution-event-detail";
import {
  ExecutionIntervalLookup,
} from "./execution-interval-record";
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
                partialTokens: data.partialTotalTokens,
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
  const [selectedInterval, setSelectedInterval] = useState<string>();
  return (
    <section className="task-execution-timeline">
      <ExecutionPages
        queryKey={["execution-tracking-events", taskId, version]}
        fetchPage={(offset, signal) =>
          api.executionTrackingEvents(taskId, { offset, limit: 20 }, signal)
        }
        label="transições"
      >
        {(rows, loading, failed) => (
          <ExecutionTimeline
            events={rows.map((row) => ({
              ...row,
              label: executionAction(row.action),
              occurredAt: row.observedAt,
            }))}
            emptyMessage={
              loading
                ? "Carregando transições…"
                : failed
                  ? "Histórico de execução indisponível."
                  : undefined
            }
            renderDetail={(event) => (
              <ExecutionEventDetail
                event={event}
                onInterval={setSelectedInterval}
              />
            )}
          />
        )}
      </ExecutionPages>
      {selectedInterval && (
        <ExecutionIntervalLookup
          key={selectedInterval}
          taskId={taskId}
          intervalId={selectedInterval}
          version={version}
        />
      )}
    </section>
  );
}
