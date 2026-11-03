import type { Task } from "@/api/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskRecordList } from "./task-record-list";
import { ChildRow } from "./subtask-row";
export function OverviewSubtasks({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subtarefas</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onOpen}>
            Ver todas e filtrar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className="overview-subtask-list"
          data-list-scroll
          tabIndex={0}
          role="region"
          aria-label="Progresso das subtarefas"
        >
          <TaskRecordList
            resource="tasks"
            scope=""
            filters={{ parentId: task.id, limit: 10, sortBy: "position" }}
            empty="Sem subtarefas"
            emptyDescription="Esta tarefa ainda não tem subtarefas diretas."
          >
            {(child) => <ChildRow task={child} />}
          </TaskRecordList>
        </div>
      </CardContent>
    </Card>
  );
}
