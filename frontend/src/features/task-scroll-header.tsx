import { useLocale, t as tr } from "@/i18n";

import type { TaskOverviewData } from "@/api/task-overview";
import {
  CompactNarrative,
  TaskDescription,
  TaskCurrentSummary,
} from "./task-header-content";
import type { Task } from "@/api/types";
import { Ban } from "lucide-react";
import { TaskProgress } from "./task-progress";
import { Markdown } from "@/components/markdown";

export { useDetailHeaderVisibility as useTaskHeaderVisibility } from "@/components/detail-layout/use-detail-header-visibility";

/** Keep the original hero and forms mounted; compact prose can be expanded accessibly. */
export function TaskCompactHeader({
  task,
  visible,
  overview,
}: {
  task: Task;
  visible: boolean;
  overview?: TaskOverviewData;
}) {
  useLocale();
  return (
    <div
      className="task-compact-header"
      data-visible={visible}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="task-compact-clip">
        <div className="task-compact-body">
          <p className="task-compact-title">{task.title}</p>
          <CompactNarrative
            label={tr("common.description")}
            text={task.description || tr("tasks.noDescriptionRecorded")}
          >
            <TaskDescription task={task} />
          </CompactNarrative>
          <div aria-hidden="true">
            <TaskProgress percent={task.progress?.percent} />
          </div>
          {task.block.blocked && (
            <div className="task-compact-blocked">
              <Ban aria-hidden="true" />
              <div>
                <strong>{tr("tasks.taskBlocked")}</strong>
                <div className="task-compact-reason" inert>
                  <Markdown headingOffset={2}>{task.block.reason}</Markdown>
                </div>
              </div>
            </div>
          )}
          <CompactNarrative
            label={tr("tasks.currentWorkSummary")}
            text={task.currentSummary || tr("boards.noUpdateRecorded")}
          >
            <TaskCurrentSummary task={task} overview={overview} />
          </CompactNarrative>
        </div>
      </div>
    </div>
  );
}
