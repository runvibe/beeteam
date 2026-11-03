import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { Task } from "@/api/types";
import { Choice, Failure } from "@/components/shared";
export function SubtaskFilterChoices(props: {
  task: Task;
  statusId: string;
  executorAgentId: string;
  blocked: string;
  includeArchived: string;
  setStatus: (v: string) => void;
  setExecutor: (v: string) => void;
  setBlocked: (v: string) => void;
  setArchived: (v: string) => void;
}) {
  const api = useApi();
  const q = useQuery({
    queryKey: ["task-overview", props.task.id, props.task.version],
    queryFn: ({ signal }) => api.overview(props.task.id, signal),
  });
  return (
    <>
      {q.error && <Failure error={q.error} retry={() => void q.refetch()} />}
      <Choice
        label="Status da subtarefa"
        value={props.statusId}
        onChange={props.setStatus}
        all="Todos os status"
        options={(q.data?.directSubtasks.byStatus ?? []).map((s) => ({
          value: s.statusId,
          label: `${s.statusName} · ${s.boardName}`,
        }))}
      />
      <Choice
        label="Responsável da subtarefa"
        value={props.executorAgentId}
        onChange={props.setExecutor}
        all="Todos os responsáveis"
        options={(q.data?.directSubtasks.byExecutor ?? []).map((a) => ({
          value: a.executorAgentId,
          label: a.agentName ?? "Agente indisponível",
        }))}
      />
      <Choice
        label="Bloqueio das subtarefas"
        value={props.blocked}
        onChange={props.setBlocked}
        all="Todas"
        options={[
          { value: "true", label: "Bloqueadas" },
          { value: "false", label: "Sem bloqueio" },
        ]}
      />
      <Choice
        label="Subtarefas arquivadas"
        value={props.includeArchived}
        onChange={props.setArchived}
        options={[
          { value: "false", label: "Somente ativas" },
          { value: "true", label: "Incluir arquivadas" },
        ]}
      />
    </>
  );
}
