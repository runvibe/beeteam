import { useLocale, t as tr } from "@/i18n";

import type { Task } from "@/api/types";
import type { TaskOverviewData } from "@/api/task-overview";
import { Markdown } from "@/components/markdown";
import { OverviewAttribution } from "./overview-artifacts";

export function TaskDescription({ task }: { task: Task }) {
  useLocale();
  return (
    <section
      className="task-header-description"
      aria-label={tr("common.description")}
    >
      <Markdown headingOffset={2} sectionDividers>
        {task.description || tr("tasks.noDescriptionRecorded")}
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
  useLocale();
  return (
    <section
      className="task-summary-section"
      aria-label={tr("tasks.currentWorkSummary")}
    >
      <h2>{tr("tasks.currentWorkSummary")}</h2>
      {task.currentSummary &&
        overview &&
        overview.task.currentSummary === task.currentSummary &&
        (overview.currentSummaryMeta ? (
          <OverviewAttribution
            relative={relativeDate}
            showActorIcon={relativeDate}
            actor={overview.currentSummaryMeta}
            date={overview.currentSummaryMeta.occurredAt}
          />
        ) : (
          <p className="small-note">
            {tr("tasks.authorshipAndDateOfThisSynthesisAreNotAvailableIn")}
          </p>
        ))}
      <Markdown headingOffset={2} sectionDividers>
        {task.currentSummary || tr("boards.noUpdateRecorded")}
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
  useLocale();
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
