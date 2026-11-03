import { TaskExecutionTracking } from "./task-execution-tracking";
import { TaskUsagePanel } from "./task-usage";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api/context";
import type { Task, Filters } from "@/api/types";
import type { TaskOverviewData } from "@/api/task-overview";
import { currentUrl, navigate } from "@/routing/location";
import { TaskOverview } from "./task-detail-layout";
import { SubtaskCharts, ProgressHistory } from "./task-overview-charts";
import {
  OverviewActivity,
  OverviewArtifacts,
  OverviewAttribution,
} from "./overview-artifacts";
import { LoadingIndicator } from "@/components/loading-indicator";
import { Failure } from "@/components/shared";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
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
  const api = useApi();
  const q = useQuery({
    queryKey: ["task-overview", task.id, task.version],
    queryFn: ({ signal }) => api.overview(task.id, signal),
  });
  const snapshot = q.data?.task ?? task;
  return (
    <div className="overview-insights">
      {q.isPending && <LoadingIndicator label="Carregando visão geral" />}
      {q.error && <Failure error={q.error} retry={() => void q.refetch()} />}
      {q.data && (
        <>
          <div className="overview-chart-grid">
            <SubtaskCharts
              data={q.data.directSubtasks}
              onFilter={openOverviewChildren}
            />
          </div>
          <ProgressHistory data={q.data.progressHistory} />
          <TaskExecutionTracking
            key={task.id}
            taskId={task.id}
            version={task.version}
          />
          <TaskUsagePanel
            taskId={task.id}
            version={task.version}
            usage={q.data.usage}
          />
        </>
      )}
      <div className="overview-reading-grid" data-loaded={!!q.data}>
        <div>
          <TaskOverview task={snapshot} />
          {q.data?.nextStep && (
            <section className="overview-next-step">
              <h2>Próximo passo registrado</h2>
              <Markdown headingOffset={2}>{q.data.nextStep}</Markdown>
            </section>
          )}
        </div>
        {q.data && <OverviewAttention data={q.data} onTab={onTab} />}
      </div>
      {q.data && (
        <div className="overview-secondary-grid">
          <OverviewArtifacts data={q.data} onTab={onTab} />
          <OverviewActivity data={q.data} onTab={onTab} />
        </div>
      )}
    </div>
  );
}
function OverviewAttention({
  data,
  onTab,
}: {
  data: TaskOverviewData;
  onTab: (tab: string) => void;
}) {
  const pending = data.latestExecutionSummary?.pending ?? [];
  const hasAttention =
    data.task.block.blocked ||
    data.directSubtasks.blocked > 0 ||
    pending.length > 0 ||
    data.decisions.length > 0;
  return (
    <section className="overview-attention">
      <h2>Atenção agora</h2>
      {data.task.block.blocked && (
        <div>
          <h3>Bloqueio da tarefa</h3>
          <Markdown headingOffset={2}>
            {data.task.block.reason || "Bloqueio registrado sem motivo."}
          </Markdown>
        </div>
      )}
      {data.directSubtasks.blocked > 0 && (
        <Button
          variant="outline"
          onClick={() => openOverviewChildren({ blocked: true })}
        >
          Ver {data.directSubtasks.blocked} subtarefas bloqueadas
        </Button>
      )}
      {!!pending.length && (
        <div>
          <h3>Pendências no último registro</h3>
          <OverviewAttribution
            actor={data.latestExecutionSummary!}
            date={data.latestExecutionSummary!.createdAt}
          />
          <ul>
            {pending.map((item, index) => (
              <li key={index}>
                <Markdown headingOffset={2}>{item}</Markdown>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => onTab("summaries")}>
            Consultar registro
          </Button>
        </div>
      )}
      {!!data.decisions.length && (
        <div>
          <h3>Decisões registradas</h3>
          {data.decisions.map((decision, index) => (
            <Markdown key={index} headingOffset={2}>
              {decision}
            </Markdown>
          ))}
        </div>
      )}
      {!hasAttention && (
        <p className="small-note">
          Nenhum bloqueio atual ou pendência no último registro disponível.
        </p>
      )}
    </section>
  );
}
