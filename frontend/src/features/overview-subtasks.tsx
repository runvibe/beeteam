import { formatPercent, formatNumber, useLocale, t as tr } from "@/i18n";

import type { Task } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  RecordedProgress,
  recordedPercent,
} from "@/components/recorded-progress";
import { useUi } from "@/state/ui";
import { TaskRecordList } from "./task-record-list";
export function OverviewSubtasks({
  task,
  total,
  onOpen,
}: {
  task: Task;
  total: number;
  onOpen: () => void;
}) {
  useLocale();
  const openTask = useUi((s) => s.openTask);
  return (
    <section aria-label={tr("tasks.subtasks")} className="overview-subtasks">
      <header className="overview-subtasks-heading">
        <h2>
          {tr("tasks.subtasks")}{" "}
          <span className="small-note">({formatNumber(total)})</span>
        </h2>
        <Button variant="ghost" size="sm" onClick={onOpen}>
          {tr("tasks.viewAllAndFilter")}
        </Button>
      </header>
      <div className="overview-subtask-list" data-list-scroll>
        <TaskRecordList
          resource="tasks"
          scope=""
          filters={{
            parentId: task.id,
            limit: 10,
            sortBy: "position",
            includeArchived: true,
          }}
          empty={tr("tasks.noSubtasks")}
          emptyDescription={tr("tasks.thisTaskHasNoDirectSubtasksYet")}
        >
          {(child) => {
            const percent = recordedPercent(child.progress?.percent);
            return (
              <div className="overview-subtask-row">
                <button
                  className="record-link"
                  onClick={() => openTask(child.id)}
                >
                  {child.title}
                </button>
                <div className="overview-subtask-meter">
                  <RecordedProgress
                    percent={percent}
                    label={tr("tasks.progressOf", { title: child.title })}
                  />
                  <span aria-hidden="true">
                    {percent === undefined ? "—" : formatPercent(percent)}
                  </span>
                </div>
              </div>
            );
          }}
        </TaskRecordList>
      </div>
    </section>
  );
}
