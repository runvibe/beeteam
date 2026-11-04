import { useLocale, t as tr } from "@/i18n";

import { AgentName } from "@/components/names";
import type { TaskExecutionTrackingEvent } from "@/api/generated/kanban/TaskExecutionTrackingEvent";
import { formatDate } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { OverviewAttribution } from "./overview-artifacts";
import { SessionSnapshot } from "./session-snapshots";
import { RecordedSummary } from "./recorded-summary";
export const executionAction = (action: string) =>
  ({
    start: tr("execution.start"),
    checkpoint: tr("execution.checkpoint"),
    pause: tr("execution.pause"),
    resume: tr("agents.resume"),
    finish: tr("execution.finish"),
  })[action] ?? action;
export function ExecutionEventDetail({
  event,
  onInterval,
  expandedSummary = false,
}: {
  event: TaskExecutionTrackingEvent;
  onInterval: (id: string) => void;
  expandedSummary?: boolean;
}) {
  useLocale();
  return (
    <div className="execution-event-detail">
      <strong>{executionAction(event.action)}</strong>
      <span className="small-note">{tr("execution.summaryAuthor")}</span>
      <OverviewAttribution
        actor={event.reportingActor}
        date={event.receivedAt}
      />
      <p>
        <span>{tr("execution.executionAgent")}</span>{" "}
        <AgentName id={event.agentId} />
      </p>
      <p>
        {tr("execution.statusWhenTheSummaryWasRecorded")}{" "}
        {event.statusObserved.name || tr("execution.notRecorded")}
      </p>
      <p>
        {tr("execution.collection")}{" "}
        {event.observedAt
          ? formatDate(event.observedAt)
          : tr("execution.noNewBoundaryObserved")}
      </p>
      <p className="small-note">
        {tr("execution.receivedAt")} {formatDate(event.receivedAt)}
      </p>
      <p>
        {tr("execution.models")}{" "}
        {event.models.length
          ? event.models.join(" · ")
          : tr("execution.notProvided")}
      </p>
      <p className="small-note">
        {tr("execution.source")} {event.source} {tr("execution.session")}{" "}
        {event.sessionId}
      </p>
      {event.reason && <p>{event.reason}</p>}
      {event.evidence.map((entry) => (
        <SessionSnapshot key={entry.id} observation={entry.observation} />
      ))}
      {!event.evidence.length && (
        <p className="small-note">
          {tr("execution.noEvidenceOfANewCollectionInThisEventDoes")}
        </p>
      )}
      <RecordedSummary
        taskId={event.taskId}
        summaryId={event.summaryId}
        expanded={expandedSummary}
      />
      {event.intervalId && (
        <Button variant="outline" onClick={() => onInterval(event.intervalId!)}>
          {tr("execution.viewInterval")}
        </Button>
      )}
    </div>
  );
}
