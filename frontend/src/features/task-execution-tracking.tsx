import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TimelineExecutionDetail } from "./timeline-execution-detail";
import { AgentName } from "@/components/names";
import { ApiError } from "@/api/types";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Failure } from "@/components/shared";
import { IntervalMetrics } from "./interval-metrics";
import { ExecutionTimeline } from "./execution-timeline";
import { ExecutionPages } from "./execution-pages";
import {
  executionAction,
} from "./execution-event-detail";
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
  const [summary, setSummary] = useState<string>();
  return (
    <section className="task-execution-timeline">
      <ExecutionPages
        queryKey={["execution-tracking-events", taskId, version]}
        fetchPage={(offset, signal) =>
          api.executionTrackingEvents(taskId, { offset, limit: 20 }, signal)
        }
        label="transições"
        showCount={false}
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
              <div className="execution-event-detail">
                <strong>{executionAction(event.action)}</strong>
                <AgentName id={event.agentId} />
                <span>{event.statusObserved.name || "Status não registrado"}</span>
                <Button variant="outline" onClick={() => setSummary(event.summaryId)}>Ver evento</Button>
              </div>
            )}
          />
        )}
      </ExecutionPages>
      <Dialog open={!!summary} onOpenChange={open => { if (!open) setSummary(undefined); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da execução</DialogTitle></DialogHeader>
          {summary && <TimelineExecutionDetail taskId={taskId} summaryId={summary} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
