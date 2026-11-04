import { useLocale, t as tr } from "@/i18n";

import type { TimelinePoint } from "@/api/timeline-points";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import { Failure } from "@/components/shared";
import { OverviewAttribution } from "./overview-artifacts";
import { useTimelineTracking } from "./timeline-execution-detail";
import { executionAction } from "./execution-event-detail";
import { eventLabels } from "./timeline-labels";
export function TimelineEventPreview({ event }: { event: TimelinePoint }) {
  useLocale();
  const api = useApi();
  const q = useQuery({
    queryKey: ["timeline", event.taskId, "point-preview", event.id],
    queryFn: async ({ signal }) => {
      const page = await api.list(
        "timeline",
        event.taskId,
        { id: event.id, offset: 0, limit: 1 },
        signal,
      );
      return (
        page.items.find(
          (row) => row.id === event.id && row.taskId === event.taskId,
        ) ?? null
      );
    },
  });
  return (
    <>
      <strong>{eventLabels[event.type] ?? event.type}</strong>
      {q.isPending && (
        <span role="status">{tr("execution.loadingPointDetails")}</span>
      )}
      {q.error && <Failure error={q.error} retry={() => void q.refetch()} />}
      {!q.isPending && !q.error && !q.data && (
        <span>{tr("execution.detailsUnavailableInThisScope")}</span>
      )}
      {q.data && (
        <OverviewAttribution actor={q.data} date={q.data.occurredAt} />
      )}
      {typeof q.data?.data.executionSummaryId === "string" && (
        <TrackingPreview
          taskId={event.taskId}
          summaryId={q.data.data.executionSummaryId}
        />
      )}
    </>
  );
}
function TrackingPreview({
  taskId,
  summaryId,
}: {
  taskId: string;
  summaryId: string;
}) {
  useLocale();
  const q = useTimelineTracking(taskId, summaryId);
  if (q.isPending)
    return (
      <span className="small-note">{tr("execution.loadingTransition")}</span>
    );
  if (q.error)
    return (
      <span className="small-note">
        {tr("execution.transitionUnavailable")}
      </span>
    );
  if (!q.data) return null;
  return (
    <span>
      {executionAction(q.data.action)} ·{" "}
      {q.data.statusObserved.name ?? tr("execution.statusNotRecorded")}
    </span>
  );
}
