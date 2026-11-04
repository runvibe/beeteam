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
  return (
    <div className="task-overview">
      <section aria-labelledby="task-progress-heading">
        <h2 id="task-progress-heading">Andamento registrado</h2>
        <Markdown headingOffset={2} sectionDividers>
          {task.progress.note || "Nenhuma nota de andamento registrada"}
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
      aria-label="Contexto da tarefa"
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
          aria-label="Voltar à tarefa"
        >
          <ArrowUpLeft aria-hidden="true" />
          Voltar
        </Button>
        <h1 ref={heading} tabIndex={-1}>
          Detalhes da tarefa
        </h1>
      </header>
      <div className="task-context-content">
        <section>
          <h2>Status</h2>
          <TaskStatus task={task} />
        </section>
        <section>
          <h2>Responsáveis</h2>
          <dl>
            <div>
              <dt>Executor</dt>
              <dd>
                <AgentName id={task.executorAgentId} />
              </dd>
            </div>
            <div>
              <dt>Autor</dt>
              <dd>
                <AgentName id={task.authorAgentId} />
              </dd>
            </div>
          </dl>
        </section>
        <section>
          <h2>Relações</h2>
          <dl>
            <div>
              <dt>Board atual</dt>
              <dd>
                <Button variant="link" onClick={() => openBoard(task.boardId)}>
                  <BoardName id={task.boardId} />
                </Button>
              </dd>
            </div>
            <div>
              <dt>Board de origem da cadeia</dt>
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
              Task pai
            </Button>
          )}
        </section>
        <TaskMode task={task} />
        <section>
          <h2>Registro</h2>
          <dl>
            <div>
              <dt>Cadastro</dt>
              <dd>{task.archivedAt ? "Arquivada" : "Ativa"}</dd>
            </div>
            <div>
              <dt>Atualizada em</dt>
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
