import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import { Failure } from "@/components/shared";
import { ExecutionEventDetail } from "./execution-event-detail";
import { ExecutionIntervalLookup } from "./execution-interval-record";
import { RecordedSummary } from "./recorded-summary";
export function TimelineExecutionDetail({taskId, summaryId}: {taskId: string; summaryId: string}) {
  const api = useApi();
  const [interval, setInterval] = useState<string>();
  const q = useQuery({
    queryKey: ["execution-tracking-events", taskId, "summary", summaryId],
    queryFn: async ({signal}) => {
      const pages = [];
      let offset: number | undefined = 0;
      while (offset !== undefined) {
        const page = await api.executionTrackingEvents(taskId, {offset, limit: 100}, signal);
        const found = page.items.find(event => event.summaryId === summaryId && event.taskId === taskId);
        if (found) return found;
        pages.push(page);
        offset = nextPageOffset(page, pages, event => event.id);
      }
      return null;
    },
  });
  if (q.isPending) return <p role="status">Carregando detalhes…</p>;
  if (q.error) return <Failure error={q.error} retry={() => void q.refetch()} />;
  return <>
    {q.data ? <ExecutionEventDetail event={q.data} onInterval={setInterval} /> : <RecordedSummary taskId={taskId} summaryId={summaryId} />}
    {interval && <ExecutionIntervalLookup taskId={taskId} intervalId={interval} version={q.data?.version ?? 1} />}
  </>;
}
export function TimelineExecutionDisclosure(props: {taskId: string; summaryId: string}) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Detalhes da execução</summary>
    {open && <TimelineExecutionDetail {...props} />}
  </details>;
}
