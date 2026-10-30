import { useId, useState } from "react";
import { ChevronDown, ArrowUpLeft } from "lucide-react";
import type { Task } from "@/api/types";
import { useUi } from "@/state/ui";
import { AgentName, BoardName } from "@/components/names";
import { TextBlock, formatDate } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskMode } from "./settings";

const sections = [
  ["overview", "Visão geral"],
  ["specification", "Especificação"],
  ["children", "Subtasks"],
  ["plans", "Planos"],
  ["comments", "Comentários"],
  ["attachments", "Arquivos"],
  ["summaries", "Resumos"],
  ["timeline", "Timeline"],
] as const;

export function TaskSections({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <TabsList className="detail-tabs task-desktop-sections">
        {sections.map(([key, label]) => (
          <TabsTrigger key={key} value={key}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <label className="task-mobile-sections">
        <span>Seção da tarefa</span>
        <select
          aria-label="Seção da tarefa"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {sections.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function TaskOverview({ task }: { task: Task }) {
  return (
    <div className="task-overview">
      <section
        className="task-summary-section"
        aria-labelledby="task-summary-heading"
      >
        <h2 id="task-summary-heading">Resumo atual do trabalho</h2>
        <TextBlock>
          {task.currentSummary || "Sem atualização registrada"}
        </TextBlock>
      </section>
      <section aria-labelledby="task-description-heading">
        <h2 id="task-description-heading">Descrição</h2>
        <TextBlock>
          {task.description || "Nenhuma descrição registrada"}
        </TextBlock>
      </section>
      <section aria-labelledby="task-progress-heading">
        <h2 id="task-progress-heading">Andamento registrado</h2>
        <TextBlock>
          {task.progress.note || "Nenhuma nota de andamento registrada"}
        </TextBlock>
      </section>
    </div>
  );
}

export function TaskContext({ task }: { task: Task }) {
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
