import {
  RecordedProgress,
  recordedPercent,
} from "@/components/recorded-progress";
import { CheckCircle2, Circle } from "lucide-react";
import { useList } from "@/api/context";
import type { Task } from "@/api/types";
import { useUi } from "@/state/ui";
import { AgentName, BoardName } from "@/components/names";
export function ChildRow({ task }: { task: Task }) {
  const percent = recordedPercent(task.progress?.percent);
  const statuses = useList("statuses", task.boardId, { limit: 100 });
  const status = statuses.data?.items.find((s) => s.id === task.statusId);
  const done = status?.isDone;
  const open = useUi((s) => s.openTask);
  return (
    <div className="record-row">
      {done ? (
        <CheckCircle2 size={18} aria-label="Concluída" />
      ) : (
        <Circle size={18} aria-label="Pendente" />
      )}
      <div className="grow min-w-0">
        <button className="record-link" onClick={() => open(task.id)}>
          {task.title}
        </button>
        <p className="small-note">
          <BoardName id={task.boardId} /> ·{" "}
          {status?.name ?? "Status indisponível"} · {task.childSummary.total}{" "}
          subtasks
        </p>
        <div className="subtask-progress">
          <RecordedProgress
            percent={percent}
            label={`Progresso de ${task.title}`}
          />
          <span aria-hidden="true">
            {percent === undefined ? "—" : `${percent}%`}
          </span>
        </div>
      </div>
      <AgentName id={task.executorAgentId} />
    </div>
  );
}
