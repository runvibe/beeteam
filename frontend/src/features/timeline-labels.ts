import type { Resources } from "@/api/types";
export const eventLabels: Record<string, string> = {
  "task.created": "Task criada",
  "task.updated": "Task atualizada",
  "assignment.changed": "Executor alterado",
  "position.changed": "Posição alterada",
  "block.changed": "Bloqueio atualizado",
  "plan.created": "Plano registrado",
  "plan.revised": "Plano revisado",
  "comment.created": "Comentário registrado",
  "attachment.added": "Arquivo anexado",
  "attachment.removed": "Arquivo removido logicamente",
  "execution.recorded": "Resumo de execução registrado",
  "task.archived": "Task arquivada",
  "task.restored": "Task restaurada",
  "subtask.created": "Subtask criada",
};
export function eventTitle(row: Resources["timeline"]) {
  return `${eventLabels[row.type] ?? row.type} · ${row.sequence}`;
}
