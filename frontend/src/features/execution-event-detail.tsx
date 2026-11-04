import { AgentName } from "@/components/names";
import type { TaskExecutionTrackingEvent } from "@/api/generated/kanban/TaskExecutionTrackingEvent";
import { formatDate } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { OverviewAttribution } from "./overview-artifacts";
import { SessionSnapshot } from "./session-snapshots";
import { RecordedSummary } from "./recorded-summary";
export const executionAction = (action: string) =>
  ({
    start: "Início",
    checkpoint: "Checkpoint",
    pause: "Pausa",
    resume: "Retomada",
    finish: "Fim",
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
  return (
    <div className="execution-event-detail">
      <strong>{executionAction(event.action)}</strong>
      <span className="small-note">Autor do resumo</span>
      <OverviewAttribution
        actor={event.reportingActor}
        date={event.receivedAt}
      />
      <p>
        <span>Agente da execução:</span> <AgentName id={event.agentId} />
      </p>
      <p>
        Status no momento do resumo:{" "}
        {event.statusObserved.name || "Não registrado"}
      </p>
      <p>
        Coleta:{" "}
        {event.observedAt
          ? formatDate(event.observedAt)
          : "Sem nova fronteira observada"}
      </p>
      <p className="small-note">Recebido em {formatDate(event.receivedAt)}</p>
      <p>
        Modelos:{" "}
        {event.models.length ? event.models.join(" · ") : "Não informados"}
      </p>
      <p className="small-note">
        Fonte: {event.source} · Sessão: {event.sessionId}
      </p>
      {event.reason && <p>{event.reason}</p>}
      {event.evidence.map((entry) => (
        <SessionSnapshot key={entry.id} observation={entry.observation} />
      ))}
      {!event.evidence.length && (
        <p className="small-note">
          Sem evidências de nova coleta neste evento. Não implica consumo zero.
        </p>
      )}
      <RecordedSummary
        taskId={event.taskId}
        summaryId={event.summaryId}
        expanded={expandedSummary}
      />
      {event.intervalId && (
        <Button variant="outline" onClick={() => onInterval(event.intervalId!)}>
          Ver intervalo
        </Button>
      )}
    </div>
  );
}
