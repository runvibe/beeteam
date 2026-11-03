import { useId, useState, type ReactNode } from "react";
import { formatDate } from "@/components/shared";
import { ChartPointPopover } from "./chart-point-popover";
import "./execution-timeline.css";

export type ExecutionTimelineEvent = {
  id: string;
  label: string;
  occurredAt: string | null;
};
export function ExecutionTimeline<T extends ExecutionTimelineEvent>({
  events,
  renderDetail,
  emptyMessage,
}: {
  events: T[];
  emptyMessage?: string;
  renderDetail: (event: T) => ReactNode;
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState<string>();
  const selected =
    events.find((event) => event.id === selectedId) ?? events.at(-1);
  return (
    <section aria-labelledby={id} className="execution-timeline">
      <h3 id={id}>Linha do tempo da execução</h3>
      <p className="small-note">
        Transições explícitas, na ordem de registro. O espaçamento separa os
        registros e não representa duração.
      </p>
      <div
        className="execution-timeline-scroll"
        role="group"
        aria-label="Transições da execução"
      >
        <div
          className="execution-timeline-plot"
          style={{ minWidth: Math.max(280, events.length * 160) }}
        >
          <div className="execution-timeline-axis" aria-hidden="true" />
          {!events.length && (
            <p className="execution-timeline-empty">
              {emptyMessage ?? "Nenhuma transição de execução registrada."}
            </p>
          )}
          {events.map((event, index) => (
            <div key={event.id}>
              <span
                className="execution-timeline-label"
                style={{ left: index * 160 + 80 }}
                aria-hidden="true"
              >
                {event.label}
                <br />
                {event.occurredAt
                  ? formatDate(event.occurredAt)
                  : "Horário não informado"}
              </span>
              <ChartPointPopover
                pointId={event.id}
                position={{ x: index * 160 + 80, y: 80 }}
                className="execution-timeline-point"
                selected={selected?.id === event.id}
                detailId={`${id}-detail`}
                label={`${event.label}: ${event.occurredAt ? formatDate(event.occurredAt) : "Horário não informado"}`}
                dialogLabel="Detalhes da transição de execução"
                onSelect={() => setSelectedId(event.id)}
              >
                {renderDetail(event)}
              </ChartPointPopover>
            </div>
          ))}
        </div>
      </div>
      {selected && (
        <>
          <label className="usage-chart-selection">
            Transição
            <select
              aria-label="Transição de execução"
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {events.map((event, index) => (
                <option key={event.id} value={event.id}>
                  {index + 1}. {event.label} ·{" "}
                  {event.occurredAt
                    ? formatDate(event.occurredAt)
                    : "Horário não informado"}
                </option>
              ))}
            </select>
          </label>
          <div
            id={`${id}-detail`}
            className="execution-timeline-detail"
            aria-live="polite"
          >
            {renderDetail(selected)}
          </div>
        </>
      )}
    </section>
  );
}
