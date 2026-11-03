import type { Task } from "@/api/types";
import { Button } from "@/components/ui/button";
import { RecordedProgress, recordedPercent } from "@/components/recorded-progress";
import { useUi } from "@/state/ui";
import { TaskRecordList } from "./task-record-list";
export function OverviewSubtasks({task, total, onOpen}: {task: Task; total: number; onOpen: () => void}) {
  const openTask = useUi(s => s.openTask);
  return <section aria-label="Subtarefas" className="overview-subtasks">
    <header className="overview-subtasks-heading">
      <h2>Subtarefas <span className="small-note">({total})</span></h2>
      <Button variant="ghost" size="sm" onClick={onOpen}>Ver todas e filtrar</Button>
    </header>
    <TaskRecordList resource="tasks" scope=""
      filters={{parentId: task.id, limit: 10, sortBy: "position", includeArchived: true}}
      empty="Sem subtarefas" emptyDescription="Esta tarefa ainda não tem subtarefas diretas.">
      {child => {
        const percent = recordedPercent(child.progress?.percent);
        return <div className="overview-subtask-row">
          <button className="record-link" onClick={() => openTask(child.id)}>{child.title}</button>
          <div className="overview-subtask-meter">
            <RecordedProgress percent={percent} label={`Progresso de ${child.title}`} />
            <span aria-hidden="true">{percent === undefined ? "—" : `${percent}%`}</span>
          </div>
        </div>;
      }}
    </TaskRecordList>
  </section>;
}
