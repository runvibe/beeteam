import { useLocale, t as tr } from "@/i18n";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Failure } from "@/components/shared";
import { ExecutionEventDetail } from "./execution-event-detail";
import { ExecutionIntervalLookup } from "./execution-interval-record";
import { RecordedSummary } from "./recorded-summary";
export function useTimelineTracking(taskId: string, summaryId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["execution-tracking-events", taskId, "summary", summaryId],
    queryFn: async ({ signal }) => {
      const page = await api.executionTrackingEvents(
        taskId,
        { summaryId, offset: 0, limit: 1 },
        signal,
      );
      return (
        page.items.find(
          (event) => event.summaryId === summaryId && event.taskId === taskId,
        ) ?? null
      );
    },
  });
}
export function TimelineExecutionDetail({
  taskId,
  summaryId,
}: {
  taskId: string;
  summaryId: string;
}) {
  useLocale();
  const [interval, setInterval] = useState<string>();
  const q = useTimelineTracking(taskId, summaryId);
  if (q.isPending) return <p role="status">{tr("execution.loadingDetails")}</p>;
  if (q.error)
    return <Failure error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      {q.data ? (
        <ExecutionEventDetail
          event={q.data}
          onInterval={setInterval}
          expandedSummary
        />
      ) : (
        <RecordedSummary taskId={taskId} summaryId={summaryId} expanded />
      )}
      {interval && (
        <ExecutionIntervalLookup
          taskId={taskId}
          intervalId={interval}
          version={q.data?.version ?? 1}
        />
      )}
    </>
  );
}
export function TimelineExecutionDisclosure(props: {
  taskId: string;
  summaryId: string;
}) {
  useLocale();
  return <TimelineExecutionDetail {...props} />;
}
