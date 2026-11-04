import { useLocale, t as tr } from "@/i18n";

import { OverviewSubtasks } from "./overview-subtasks";
import { OverviewUsageCards } from "./overview-usage-cards";
import { TaskExecutionTracking } from "./task-execution-tracking";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { Task, Filters } from "@/api/types";
import { currentUrl, navigate } from "@/routing/location";
import { ProgressHistory } from "./task-overview-charts";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure } from "@/components/shared";
import "./task-overview-panel.css";

export function openOverviewChildren(filters: Filters) {
  const [path, search] = currentUrl().split("?"),
    query = new URLSearchParams(search);
  for (const key of [...query.keys()])
    if (key.startsWith("children.") && !key.endsWith("limit"))
      query.delete(key);
  query.set("tab", "children");
  query.set("children.includeArchived", "true");
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined) query.set(`children.${key}`, String(value));
  navigate(`${path}?${query}`);
}
export function TaskOverviewPanel({
  task,
  onTab,
}: {
  task: Task;
  onTab: (tab: string) => void;
}) {
  useLocale();
  const api = useApi();
  const q = useQuery({
    queryKey: ["task-overview", task.id, task.version],
    queryFn: ({ signal }) => api.overview(task.id, signal),
  });
  return (
    <div className="overview-insights">
      {q.isPending && <LoadingIndicator label={tr("tasks.loadingOverview")} />}
      {q.error && <Failure error={q.error} retry={() => void q.refetch()} />}
      {q.data && (
        <>
          <TaskExecutionTracking
            key={task.id}
            taskId={task.id}
            version={task.version}
          />
          <ProgressHistory
            taskId={task.id}
            data={q.data.progressHistory}
            mode="chart"
          />
          <div className="overview-work-and-usage">
            <OverviewSubtasks
              total={q.data.directSubtasks.total}
              task={task}
              onOpen={() => onTab("children")}
            />
            <OverviewUsageCards taskId={task.id} version={task.version} />
          </div>
        </>
      )}
    </div>
  );
}
