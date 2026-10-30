import { goBack } from "@/routing/location";
import { useUrlState, usePageSize, booleanValues } from "@/routing/query";
import { FilterBar } from "@/components/filter-bar";
import { TaskPath } from "@/components/context-path";
import { useEffect, useRef, useState } from "react";
import { Plans } from "./plans";
import { Markdown } from "@/components/markdown";
import {
  ArrowUpLeft,
  Ban,
  Download,
  CheckCircle2,
  Circle,
  ExternalLink,
} from "lucide-react";
import { useApi, useEntity, useList } from "@/api/context";
import type { Resources, Task } from "@/api/types";
import { useUi } from "@/state/ui";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Choice,
  TextBlock,
  QueryState,
  Pager,
  NoData,
  Failure,
  formatDate,
  safeUrl,
} from "@/components/shared";
import { AgentName, BoardName } from "@/components/names";
import { TaskContext, TaskSections, TaskOverview } from "./task-detail-layout";
import "./task-detail.css";
export function TaskPage() {
  const id = useUi((s) => s.taskId);
  return id ? (
    <section className="task-page" aria-label="Task">
      <TaskDetail key={id} id={id} />
    </section>
  ) : null;
}
function TaskDetail({ id }: { id: string }) {
  const q = useEntity("tasks", id);
  const heading = useRef<HTMLHeadingElement>(null);
  const [tab, setTab] = useUrlState<string>("tab", "overview", {
    values: [
      "overview",
      "specification",
      "children",
      "plans",
      "comments",
      "attachments",
      "summaries",
      "timeline",
    ],
  });
  useEffect(() => {
    heading.current?.focus();
  }, [id]);
  return (
    <div className="task-detail-columns">
      <div className="task-detail-primary">
        <Button
          variant="ghost"
          className="task-back"
          onClick={() =>
            goBack(q.data ? `/boards/${q.data.boardId}` : "/boards")
          }
        >
          <ArrowUpLeft />
          Voltar
        </Button>
        {q.data && <TaskPath task={q.data} />}
        <header className="task-detail-heading">
          <h1 ref={heading} tabIndex={-1}>
            {q.data?.title ?? "Detalhes da task"}
          </h1>
        </header>
        <QueryState query={q}>
          {q.data && (
            <>
              <div className="task-detail-state" aria-label="Estado da tarefa">
                <div>
                  <span>Status</span>
                  <TaskStatus task={q.data} />
                </div>
                <div>
                  <span>Progresso registrado</span>
                  <strong>{q.data.progress.percent}%</strong>
                </div>
                <div>
                  <span>Executor</span>
                  <AgentName id={q.data.executorAgentId} />
                </div>
                {q.data.archivedAt && (
                  <Badge variant="secondary">Arquivada: somente leitura</Badge>
                )}
              </div>
              {q.data.block.blocked && (
                <Alert variant="destructive" className="task-blocked-alert">
                  <Ban className="size-9" aria-hidden="true" />
                  <div className="task-blocked-message">
                    <AlertTitle>Task bloqueada</AlertTitle>
                    <AlertDescription>{q.data.block.reason}</AlertDescription>
                  </div>
                </Alert>
              )}
              <Tabs
                value={tab}
                onValueChange={setTab}
                className="task-detail-tabs"
              >
                <TaskSections value={tab} onChange={setTab} />
                <div className="task-detail-reading">
                  <TabsContent value="overview">
                    <TaskOverview task={q.data} />
                  </TabsContent>
                  <TabsContent value="specification">
                    <div className="detail-section task-specification">
                      <header className="task-reading-block">
                        <h2>Especificação</h2>
                        <p className="small-note">
                          Requisitos, entrega esperada e critérios de aceite.
                        </p>
                      </header>
                      {q.data.specification ? (
                        <Markdown headingOffset={2} sectionDividers>
                          {q.data.specification}
                        </Markdown>
                      ) : (
                        <NoData
                          title="Nenhuma especificação registrada"
                          description="Os requisitos e critérios de aceite serão exibidos nesta seção quando registrados."
                        />
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="children">
                    <Children task={q.data} />
                  </TabsContent>
                  <TabsContent value="plans">
                    <Plans task={q.data} />
                  </TabsContent>
                  <TabsContent value="comments">
                    <Records resource="comments" task={q.data} />
                  </TabsContent>
                  <TabsContent value="attachments">
                    <Records resource="attachments" task={q.data} />
                  </TabsContent>
                  <TabsContent value="summaries">
                    <Records resource="summaries" task={q.data} />
                  </TabsContent>
                  <TabsContent value="timeline">
                    <Records resource="timeline" task={q.data} />
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </QueryState>
      </div>
      {q.data && <TaskContext task={q.data} />}
    </div>
  );
}
function Children({ task }: { task: Task }) {
  const [offset, setOffset] = useUrlState<number>("children.offset", 0);
  const limit = usePageSize("children", 10);
  const q = useList("tasks", "", {
    parentId: task.id,
    offset,
    limit,
    sortBy: "position",
  });
  return (
    <div className="detail-section">
      <p className="muted-copy">
        Filhos diretos em todos os boards. Abra uma subtask para consultar os
        próximos níveis.
      </p>
      <QueryState query={q}>
        {q.data && (
          <>
            {q.data.items.map((child) => (
              <ChildRow key={child.id} task={child} />
            ))}
            {!q.data.items.length && (
              <NoData
                title="Sem subtasks"
                description="Esta tarefa ainda não tem subtasks diretas."
              />
            )}
            <Pager page={q.data} onOffset={setOffset} />
          </>
        )}
      </QueryState>
    </div>
  );
}
function ChildRow({ task }: { task: Task }) {
  const statuses = useList("statuses", task.boardId, { limit: 100 });
  const done = statuses.data?.items.find((s) => s.id === task.statusId)?.isDone;
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
          <BoardName id={task.boardId} /> · {task.childSummary.total} subtasks
        </p>
      </div>
      <AgentName id={task.executorAgentId} />
    </div>
  );
}
type RecordKind = "comments" | "attachments" | "summaries" | "timeline";
function Records({ resource, task }: { resource: RecordKind; task: Task }) {
  const [offset, setOffset] = useUrlState<number>(`${resource}.offset`, 0),
    [includeChildren, setInclude] = useUrlState<string>(
      "timeline.includeChildren",
      "false",
      { values: booleanValues },
    );
  const limit = usePageSize(resource, 10);
  const q = useList(resource, task.id, {
    offset,
    limit,
    ...(resource === "timeline"
      ? {
          includeChildren: includeChildren === "true",
          sortBy: "sequence",
          sortOrder: "desc" as const,
        }
      : {}),
  });
  return (
    <div className="detail-section">
      {resource === "timeline" && (
        <FilterBar
          active={includeChildren !== "false"}
          onClear={() => {
            setInclude("false");
            setOffset(0);
          }}
        >
          <Choice
            label="Eventos"
            value={includeChildren}
            onChange={(v) => {
              setInclude(v);
              setOffset(0);
            }}
            options={[
              { value: "false", label: "Somente esta task" },
              { value: "true", label: "Incluir toda a descendência" },
            ]}
          />
        </FilterBar>
      )}
      <QueryState query={q}>
        {q.data && (
          <>
            {q.data.items.map((row) => (
              <RecordContent key={row.id} kind={resource} row={row} />
            ))}
            {!q.data.items.length && (
              <NoData
                title="Nenhum registro nesta seção"
                description="Os registros vinculados à tarefa serão exibidos aqui quando disponíveis."
              />
            )}
            <Pager page={q.data} onOffset={setOffset} />
          </>
        )}
      </QueryState>
    </div>
  );
}
function RecordContent({
  kind,
  row,
}: {
  kind: RecordKind;
  row: Resources[RecordKind];
}) {
  if (kind === "attachments")
    return <Attachment item={row as Resources["attachments"]} />;
  if (kind === "comments") {
    const r = row as Resources["comments"];
    return (
      <article className="record">
        <Author id={r.actorId} date={r.createdAt} />
        <TextBlock>{r.body}</TextBlock>
      </article>
    );
  }
  if (kind === "summaries") {
    const r = row as Resources["summaries"];
    return (
      <article className="record task-execution-summary">
        <section className="task-reading-block">
          <Author id={r.actorId} date={r.createdAt} />
          <Badge variant="secondary">
            {
              {
                progress: "Em progresso",
                completed: "Concluída",
                blocked: "Bloqueada",
              }[r.outcome]
            }
          </Badge>
          <TextBlock>{r.summary}</TextBlock>
        </section>
        <section className="task-reading-block" aria-label="Entregas">
          <h4>Entregas</h4>
          {r.deliverables.length ? (
            r.deliverables.map((d, i) => (
              <div key={i}>
                {safeUrl(d.url) ? (
                  <a href={safeUrl(d.url)} target="_blank" rel="noreferrer">
                    {d.label} <ExternalLink size={12} />
                  </a>
                ) : (
                  d.label
                )}
              </div>
            ))
          ) : (
            <p className="small-note">Nenhuma entrega registrada.</p>
          )}
        </section>
        <section className="task-reading-block" aria-label="Pendências">
          <h4>Pendências</h4>
          {r.pending.length ? (
            <ul className="list-disc pl-5">
              {r.pending.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="small-note">Sem pendências registradas.</p>
          )}
        </section>
      </article>
    );
  }
  const r = row as Resources["timeline"];
  return (
    <article className="record timeline-record">
      <Author id={r.actorId} date={r.occurredAt} />
      <strong>{eventLabels[r.type] ?? r.type}</strong>
      <p className="small-note">
        Task {r.taskId.slice(-4)} · evento {r.sequence}
      </p>
      <details>
        <summary>Dados do evento</summary>
        <pre>{JSON.stringify(r.data, null, 2)}</pre>
      </details>
    </article>
  );
}
const eventLabels: Record<string, string> = {
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
function Author({ id, date }: { id: string | null; date: string }) {
  return (
    <div className="record-author">
      <AgentName id={id} />
      <time dateTime={date}>{formatDate(date)}</time>
    </div>
  );
}
function Attachment({ item }: { item: Resources["attachments"] }) {
  const api = useApi();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    setError(null);
    try {
      const blob = await api.download(item.taskId, item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.originalName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="record">
      <Author id={item.actorId} date={item.createdAt} />
      <h3>{item.originalName}</h3>
      <p className="small-note">
        {item.mediaType} · {item.sizeBytes} bytes
      </p>
      <TextBlock>{item.description}</TextBlock>
      <Button variant="outline" disabled={busy} onClick={() => void download()}>
        <Download data-icon="inline-start" />
        {busy ? "Preparando…" : "Baixar arquivo"}
      </Button>
      {error && <Failure error={error} />}
    </article>
  );
}

function TaskStatus({ task }: { task: Task }) {
  const q = useList("statuses", task.boardId, {
    limit: 100,
    includeArchived: true,
  });
  return (
    <Badge variant="outline">
      {q.data?.items.find((s) => s.id === task.statusId)?.name ?? "Carregando…"}
    </Badge>
  );
}
