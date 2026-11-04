import { useLocale, t as tr } from "@/i18n";
import { closeTaskDetails } from "@/routing/task-details-view";
import { useTaskContextView, useTaskMobile } from "./task-context-view";
import { useEffect, useRef } from "react";
import { ArrowUpLeft } from "lucide-react";
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
  const details = useTaskContextView();
  const mobile = useTaskMobile();
  const heading = useRef<HTMLHeadingElement>(null);
  const wasDetails = useRef(details);
  useEffect(() => {
    if (details) heading.current?.focus({ preventScroll: true });
    else if (wasDetails.current && !mobile)
      document.querySelector<HTMLElement>(".task-detail-primary h1")?.focus({ preventScroll: true });
    wasDetails.current = details;
  }, [details, mobile]);
  const openTask = useUi((s) => s.openTask);
  const openBoard = useUi((s) => s.openBoard);
  return (
    <aside
      className="task-context"
      aria-label={tr("tasks.taskContext")}
      data-detail-screen={details}
      hidden={mobile && !details}
    >
      <TaskCompactHeader
        task={task}
        visible={compactHeader}
        overview={overview}
      />
      <header className="task-context-screen-header" hidden={!details}>
        <Button
          variant="ghost"
          onClick={closeTaskDetails}
          aria-label={tr("tasks.backToTask")}
        >
          <ArrowUpLeft aria-hidden="true" />
          {tr("common.back")}
        </Button>
        <h1 ref={heading} tabIndex={-1}>
          {tr("tasks.taskDetails")}
        </h1>
      </header>
      <div className="task-context-content">
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
