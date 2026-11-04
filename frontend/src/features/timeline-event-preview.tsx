import type { Resources } from "@/api/types";
import { OverviewAttribution } from "./overview-artifacts";
import { useTimelineTracking } from "./timeline-execution-detail";
import { executionAction } from "./execution-event-detail";
import { eventLabels } from "./timeline-labels";
export function TimelineEventPreview({
  event,
}: {
  event: Resources["timeline"];
}) {
  return (
    <>
      <strong>{eventLabels[event.type] ?? event.type}</strong>
      <OverviewAttribution actor={event} date={event.occurredAt} />
      {typeof event.data.executionSummaryId === "string" && (
        <TrackingPreview
          taskId={event.taskId}
          summaryId={event.data.executionSummaryId}
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
  const q = useTimelineTracking(taskId, summaryId);
  if (q.isPending)
    return <span className="small-note">Carregando transição…</span>;
  if (q.error)
    return <span className="small-note">Transição indisponível</span>;
  if (!q.data) return null;
  return (
    <span>
      {executionAction(q.data.action)} ·{" "}
      {q.data.statusObserved.name ?? "Status não registrado"}
    </span>
  );
}
