import { useLocale, t as tr } from "@/i18n";

import { useId, useState } from "react";
import { ChevronDown, ArrowUpLeft } from "lucide-react";
import type { TaskOverviewData } from "@/api/task-overview";
import type { Task } from "@/api/types";
import { useUi } from "@/state/ui";
import { AgentName, BoardName } from "@/components/names";
import { formatDate } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
export { TaskSections } from "./task-sections";
import { TaskMode } from "./settings";
import { TaskCompactHeader } from "./task-scroll-header";
import { TaskStatus } from "./task-status";

export function TaskOverview({ task }: { task: Task }) {
  useLocale();
  return (
    <div className="task-overview">
      <section aria-labelledby="task-progress-heading">
        <h2 id="task-progress-heading">{tr("tasks.recordedUpdates")}</h2>
        <Markdown headingOffset={2} sectionDividers>
          {task.progress.note || tr("tasks.noProgressNotesRecorded")}
        </Markdown>
      </section>
    </div>
  );
}

export function TaskContext({
  task,
  compactHeader = false,
  overview,
}: {
  task: Task;
  compactHeader?: boolean;
  overview?: TaskOverviewData;
}) {
  useLocale();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const openTask = useUi((s) => s.openTask);
  const openBoard = useUi((s) => s.openBoard);
  return (
    <aside
      className="task-context"
      aria-label={tr("tasks.taskContext")}
      data-expanded={expanded}
    >
      <TaskCompactHeader
        task={task}
        visible={compactHeader}
        overview={overview}
      />
      <Button
        variant="ghost"
        className="task-context-toggle"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(!expanded)}
      >
        <span>
          {tr("tasks.taskDetails")}{" "}
          <small>
            {tr("common.autonomy")}{" "}
            {task.executionContext.effectiveMode === "automatic"
              ? tr("tasks.automatic")
              : tr("common.manualLower")}
          </small>
        </span>
        <ChevronDown aria-hidden="true" />
      </Button>
      <div className="task-context-content" id={contentId}>
        <section>
          <h2>{tr("boards.status")}</h2>
          <TaskStatus task={task} />
        </section>
        <section>
          <h2>{tr("tasks.assignees")}</h2>
          <dl>
            <div>
              <dt>{tr("boards.executor")}</dt>
              <dd>
                <AgentName id={task.executorAgentId} />
              </dd>
            </div>
            <div>
              <dt>{tr("tasks.author")}</dt>
              <dd>
                <AgentName id={task.authorAgentId} />
              </dd>
            </div>
          </dl>
        </section>
        <section>
          <h2>{tr("tasks.relationships")}</h2>
          <dl>
            <div>
              <dt>{tr("tasks.currentBoard")}</dt>
              <dd>
                <Button variant="link" onClick={() => openBoard(task.boardId)}>
                  <BoardName id={task.boardId} />
                </Button>
              </dd>
            </div>
            <div>
              <dt>{tr("tasks.chainOriginBoard")}</dt>
              <dd>
                <Button
                  variant="link"
                  onClick={() => openBoard(task.executionContext.originBoardId)}
                >
                  <BoardName id={task.executionContext.originBoardId} />
                </Button>
              </dd>
            </div>
          </dl>
          {task.parentId && (
            <Button variant="link" onClick={() => openTask(task.parentId!)}>
              <ArrowUpLeft />
              {tr("tasks.parentTask")}
            </Button>
          )}
        </section>
        <TaskMode task={task} />
        <section>
          <h2>{tr("tasks.record")}</h2>
          <dl>
            <div>
              <dt>{tr("agents.registry")}</dt>
              <dd>
                {task.archivedAt ? tr("tasks.archived") : tr("tasks.active")}
              </dd>
            </div>
            <div>
              <dt>{tr("tasks.updatedAt")}</dt>
              <dd>
                <time dateTime={task.updatedAt}>
                  {formatDate(task.updatedAt)}
                </time>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  );
}
