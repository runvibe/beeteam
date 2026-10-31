import type { Task } from "@/api/types";
import type { TaskOverviewData } from "@/api/task-overview";
import { Markdown } from "@/components/markdown";
import { OverviewAttribution } from "./overview-artifacts";

export function TaskDescription({ task }: { task: Task }) {
  return (
    <section className="task-header-description" aria-label="Descrição">
      <Markdown headingOffset={2} sectionDividers>
        {task.description || "Nenhuma descrição registrada"}
      </Markdown>
    </section>
  );
}
export function TaskCurrentSummary({
  task,
  overview,
  relativeDate = false,
}: {
  task: Task;
  overview?: TaskOverviewData;
  relativeDate?: boolean;
}) {
  return (
    <section
      className="task-summary-section"
      aria-label="Resumo atual do trabalho"
    >
      <h2>Resumo atual do trabalho</h2>
      {task.currentSummary &&
        overview &&
        overview.task.currentSummary === task.currentSummary &&
        (overview.currentSummaryMeta ? (
          <OverviewAttribution
            relative={relativeDate}
            actor={overview.currentSummaryMeta}
            date={overview.currentSummaryMeta.occurredAt}
          />
        ) : (
          <p className="small-note">
            Autoria e data desta síntese não disponíveis nos registros.
          </p>
        ))}
      <Markdown headingOffset={2} sectionDividers>
        {task.currentSummary || "Sem atualização registrada"}
      </Markdown>
    </section>
  );
}
export function CompactNarrative({
  label,
  children,
  text,
}: {
  label: string;
  children: React.ReactNode;
  text: string;
}) {
  return (
    <div className="task-compact-narrative">
      <details>
        <summary>{label}</summary>
        <div className="task-compact-full">{children}</div>
      </details>
      <div className="task-compact-preview" aria-hidden="true" inert>
        <Markdown headingOffset={2}>{text}</Markdown>
      </div>
    </div>
  );
}
