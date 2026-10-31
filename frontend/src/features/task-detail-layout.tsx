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
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const openTask = useUi((s) => s.openTask);
  const openBoard = useUi((s) => s.openBoard);
  return (
    <aside
      className="task-context"
      aria-label="Contexto da tarefa"
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
          Detalhes da tarefa{" "}
          <small>
            Autonomia{" "}
            {task.executionContext.effectiveMode === "automatic"
              ? "automática"
              : "manual"}
          </small>
        </span>
        <ChevronDown aria-hidden="true" />
      </Button>
      <div className="task-context-content" id={contentId}>
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
