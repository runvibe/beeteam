import { useLocale, t as tr } from "@/i18n";

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
  useLocale();
  const api = useApi();
  const q = useQuery({
    queryKey: ["task-overview", props.task.id, props.task.version],
    queryFn: ({ signal }) => api.overview(props.task.id, signal),
  });
  return (
    <>
      {q.error && <Failure error={q.error} retry={() => void q.refetch()} />}
      <Choice
        label={tr("tasks.subtaskStatus")}
        value={props.statusId}
        onChange={props.setStatus}
        all={tr("tasks.allStatuses")}
        options={(q.data?.directSubtasks.byStatus ?? []).map((s) => ({
          value: s.statusId,
          label: `${s.statusName} · ${s.boardName}`,
        }))}
      />
      <Choice
        label={tr("tasks.subtaskAssignee")}
        value={props.executorAgentId}
        onChange={props.setExecutor}
        all={tr("tasks.allAssignees")}
        options={(q.data?.directSubtasks.byExecutor ?? []).map((a) => ({
          value: a.executorAgentId,
          label: a.agentName ?? tr("common.agentUnavailable"),
        }))}
      />
      <Choice
        label={tr("tasks.subtaskBlocking")}
        value={props.blocked}
        onChange={props.setBlocked}
        all={tr("agents.all")}
        options={[
          { value: "true", label: tr("boards.blocked") },
          { value: "false", label: tr("boards.notBlocked") },
        ]}
      />
      <Choice
        label={tr("tasks.archivedSubtasks")}
        value={props.includeArchived}
        onChange={props.setArchived}
        options={[
          { value: "false", label: tr("tasks.activeOnly") },
          { value: "true", label: tr("tasks.includeArchived") },
        ]}
      />
    </>
  );
}
