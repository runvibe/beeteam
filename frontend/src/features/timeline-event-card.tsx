import { formatNumber, useLocale, t as tr } from "@/i18n";

import type { Resources } from "@/api/types";
import { useEntity } from "@/api/context";
import { eventLabels } from "./timeline-labels";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OverviewAttribution } from "./overview-artifacts";
import { TimelineExecutionDetail } from "./timeline-execution-detail";
import { TimelineEventReference } from "./timeline-event-reference";
import { ChangedFields, EventFields } from "./timeline-event-fields";
import "./timeline-event-card.css";
function EventTaskOrigin({ taskId }: { taskId: string }) {
  useLocale();
  const task = useEntity("tasks", taskId);
  return (
    <p className="small-note timeline-task-origin" title={taskId}>
      {tr("execution.originTask")} {task.data?.title ?? taskId}
    </p>
  );
}
export function TimelineEventCard({ event }: { event: Resources["timeline"] }) {
  useLocale();
  const label = eventLabels[event.type] ?? event.type;
  const referenced = [
    "comment.created",
    "plan.created",
    "plan.revised",
    "attachment.added",
    "attachment.removed",
  ].includes(event.type);
  return (
    <Card
      role="article"
      aria-label={`${label} · ${event.sequence}`}
      className="task-execution-summary timeline-event-card"
    >
      <CardHeader className="summary-record-header">
        <CardTitle>{label}</CardTitle>
        <div className="record-author">
          <OverviewAttribution actor={event} date={event.occurredAt} />
        </div>
        <EventTaskOrigin taskId={event.taskId} />
        <Badge variant="secondary">
          {tr("tasks.event")} {formatNumber(event.sequence)}
        </Badge>
      </CardHeader>
      <CardContent className="summary-record-content">
        {referenced ? (
          <TimelineEventReference event={event} />
        ) : event.type === "execution.recorded" &&
          typeof event.data.executionSummaryId === "string" ? (
          <>
            <EventFields
              data={Object.fromEntries(
                Object.entries(event.data).filter(
                  ([key]) => key !== "executionSummaryId",
                ),
              )}
            />
            <TimelineExecutionDetail
              taskId={event.taskId}
              summaryId={event.data.executionSummaryId}
            />
          </>
        ) : event.type === "task.updated" ? (
          <ChangedFields
            previous={event.data.previous}
            changes={event.data.changes}
          />
        ) : event.type === "block.changed" ? (
          <ChangedFields
            previous={{ block: event.data.previous }}
            changes={{ block: event.data.block }}
          />
        ) : (
          <EventFields data={event.data} />
        )}
        <details className="timeline-original-data">
          <summary>{tr("execution.originalEventRecord")}</summary>
          <pre>{JSON.stringify(event.data, null, 2)}</pre>
        </details>
      </CardContent>
    </Card>
  );
}
