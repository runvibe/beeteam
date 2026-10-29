import { openCardBody, openCardLink } from "@/routing/card-navigation";
import { FilterBar } from "@/components/filter-bar";
import { FilterPopover } from "@/components/filter-controls";
import { EntityFilter } from "@/components/entity-filter";
import {
  useUrlState,
  usePageSize,
  booleanValues,
  validDate,
} from "@/routing/query";
import {
  useLocation,
  destination,
  subroute,
  navigate,
  goBack,
} from "@/routing/location";
import { useQuery } from "@tanstack/react-query";
import { Settings2, CheckCheck, LockKeyhole, ArrowUpLeft } from "lucide-react";
import { useApi, useEntity, useList } from "@/api/context";
import type { BoardView, Filters, Task } from "@/api/types";
import { useUi } from "@/state/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Choice,
  Search,
  QueryState,
  NoData,
  Pager,
  formatDate,
  modeLabels,
} from "@/components/shared";
import { AgentName } from "@/components/names";
import { BoardSettings } from "./settings";
export function Boards() {
  const selected = useUi((s) => s.boardId);
  return selected ? (
    <BoardScreen key={selected} id={selected} />
  ) : (
    <BoardIndex />
  );
}
function BoardIndex() {
  const [name, setName] = useUrlState<string>("boards.name", ""),
    [teamId, setTeam] = useUrlState<string>("boards.teamId", ""),
    [archived, setArchived] = useUrlState<string>("boards.archived", "false", {
      values: booleanValues,
    }),
    [offset, setOffset] = useUrlState<number>("boards.offset", 0);
  const limit = usePageSize("boards", 12);
  const q = useList("boards", "", {
    name: name || undefined,
    teamId: teamId || undefined,
    archived: archived === "" ? undefined : archived === "true",
    offset,
    limit,
    sortBy: "name",
  });
  const teams = useList("teams", "", { limit: 100, sortBy: "name" });
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Boards</h1>
          <p>Uma visão do trabalho, das decisões e do que vem a seguir.</p>
        </div>
      </header>
      <FilterBar
        search={
          <>
            <Search
              value={name}
              onChange={(v) => {
                setName(v);
                setOffset(0);
              }}
              label="Buscar boards"
            />
          </>
        }
        active={!!(name || teamId || archived !== "false")}
        onClear={() => {
          setName("");
          setTeam("");
          setArchived("false");
          setOffset(0);
        }}
      >
        <EntityFilter
          resource="teams"
          label="Time gestor"
          value={teamId}
          onChange={(v) => {
            setTeam(v);
            setOffset(0);
          }}
        />
        <Choice
          label="Cadastro"
          value={archived}
          onChange={(v) => {
            setArchived(v);
            setOffset(0);
          }}
          options={[
            { value: "false", label: "Ativos" },
            { value: "true", label: "Arquivados" },
          ]}
        />
      </FilterBar>
      <QueryState query={q}>
        {q.data && (
          <>
            {q.data.items.length ? (
              <div className="board-grid">
                {q.data.items.map((b) => (
                  <a
                    key={b.id}
                    className="board-card-link"
                    aria-label={b.name}
                    href={destination(`/boards/${b.id}`)}
                    onClick={openCardLink}
                  >
                    <Card className="board-card">
                      <CardHeader>
                        <CardDescription>
                          {teams.data?.items.find((t) => t.id === b.teamId)
                            ?.name ?? "Time gestor"}
                        </CardDescription>
                        <CardTitle>{b.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="muted-copy">{b.description}</p>
                      </CardContent>
                      <CardFooter className="justify-between gap-2">
                        <Badge variant="secondary">
                          {modeLabels[b.autonomyMode]}
                        </Badge>
                        <span className="small-note">
                          {formatDate(b.updatedAt)}
                        </span>
                      </CardFooter>
                    </Card>
                  </a>
                ))}
              </div>
            ) : (
              <NoData
                title={
                  name || teamId
                    ? "Nenhum board corresponde aos filtros"
                    : "Nenhum board neste cadastro"
                }
                description="Ajuste os filtros para consultar outros boards."
              />
            )}
            <Pager page={q.data} onOffset={setOffset} />
          </>
        )}
      </QueryState>
    </>
  );
}
function BoardScreen({ id }: { id: string }) {
  const api = useApi();
  const entity = useEntity("boards", id);
  const [title, setTitle] = useUrlState<string>("kanban.title", ""),
    [blocked, setBlocked] = useUrlState<string>("kanban.blocked", "", {
      values: booleanValues,
    }),
    [executor, setExecutor] = useUrlState<string>("kanban.executor", ""),
    [updatedFrom, setUpdatedFrom] = useUrlState<string>(
      "kanban.updatedFrom",
      "",
      { validate: validDate },
    ),
    limit = usePageSize("kanban", 3);
  const settings = useLocation().split("?")[0].endsWith("/settings");
  const setSettings = (open: boolean) =>
    open
      ? navigate(subroute(`/boards/${id}/settings`))
      : goBack(`/boards/${id}`);

  const filters: Filters = {
    title: title || undefined,
    blocked: blocked === "" ? undefined : blocked === "true",
    executorAgentId: executor || undefined,
    updatedFrom: updatedFrom ? new Date(updatedFrom).toISOString() : undefined,
    limitPerColumn: limit,
  };
  const q = useQuery({
    queryKey: ["board-view", id, filters],
    queryFn: () => api.board(id, filters),
  });
  return (
    <>
      <Button
        variant="ghost"
        className="task-back"
        onClick={() => goBack("/boards")}
      >
        <ArrowUpLeft />
        Voltar
      </Button>
      <QueryState query={entity}>
        {entity.data && (
          <header className="page-heading">
            <div>
              <h1>{entity.data.name}</h1>
              <p>{entity.data.description}</p>
            </div>
            <Button variant="outline" onClick={() => setSettings(true)}>
              <Settings2 data-icon="inline-start" />
              Configurações
            </Button>
          </header>
        )}
      </QueryState>
      <FilterBar
        search={
          <>
            <Search value={title} onChange={setTitle} label="Buscar tasks" />
          </>
        }
        active={!!(title || executor || blocked || updatedFrom)}
        onClear={() => {
          setTitle("");
          setExecutor("");
          setBlocked("");
          setUpdatedFrom("");
        }}
      >
        <EntityFilter
          resource="agents"
          label="Executor"
          value={executor}
          onChange={setExecutor}
        />
        <Choice
          label="Bloqueio"
          value={blocked}
          onChange={setBlocked}
          options={[
            { value: "true", label: "Bloqueadas" },
            { value: "false", label: "Sem bloqueio" },
          ]}
          all="Todas"
        />
        <FilterPopover
          label="Atualizadas desde"
          active={!!updatedFrom}
          summary={updatedFrom}
        >
          <label className="date-filter">
            Atualizadas desde
            <input
              aria-label="Atualizadas desde"
              type="date"
              value={updatedFrom}
              onChange={(e) => setUpdatedFrom(e.target.value)}
            />
          </label>
        </FilterPopover>
      </FilterBar>
      <div className="board-meta">
        <span>Tasks principais · subtasks no detalhe de cada task</span>
        <span>Atualizações registradas, sem indicação de execução ao vivo</span>
      </div>
      <QueryState query={q}>
        {q.data && (
          <div className="kanban" key={JSON.stringify(filters)}>
            {q.data.columns.map((c) => (
              <Column
                key={c.status.id}
                boardId={id}
                column={c}
                filters={filters}
              />
            ))}
          </div>
        )}
      </QueryState>
      {entity.data && (
        <BoardSettings
          board={entity.data}
          open={settings}
          onOpenChange={setSettings}
        />
      )}
    </>
  );
}
function Column({
  column,
  boardId,
  filters,
}: {
  column: BoardView["columns"][number];
  boardId: string;
  filters: Filters;
}) {
  const api = useApi();
  const [offset, setOffset] = useUrlState<number>(
    `kanban.${column.status.id}.offset`,
    0,
  );
  const { limitPerColumn, ...continuation } = filters;
  const q = useQuery({
    queryKey: [
      "column",
      boardId,
      column.status.id,
      continuation,
      offset,
      limitPerColumn,
    ],
    queryFn: () =>
      api.list("tasks", boardId, {
        ...continuation,
        statusId: column.status.id,
        rootOnly: true,
        archived: false,
        sortBy: "position",
        sortOrder: "asc",
        offset,
        limit: limitPerColumn,
      }),
    enabled: offset > 0,
  });
  const page =
    offset === 0
      ? {
          items: column.tasks,
          offset: 0,
          limit: column.limit,
          total: column.total,
          hasMore: column.hasMore,
          nextOffset: column.nextOffset,
        }
      : q.data;
  return (
    <section className="kanban-column" aria-label={column.status.name}>
      <div className="column-heading">
        <span
          className={column.status.isDone ? "status-dot done" : "status-dot"}
        />
        <h2>{column.status.name}</h2>
        <span>{column.total}</span>
      </div>
      {offset > 0 ? (
        <QueryState query={q}>
          {page?.items.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </QueryState>
      ) : (
        page?.items.map((t) => <TaskCard key={t.id} task={t} />)
      )}
      {page?.items.length === 0 && (
        <NoData
          title="Sem tasks"
          description="Nenhuma task corresponde a esta coluna."
        />
      )}
      {page && (page.hasMore || offset > 0) && (
        <Pager page={page} onOffset={setOffset} />
      )}
    </section>
  );
}
export function TaskCard({ task }: { task: Task }) {
  const href = destination(`/tasks/${task.slug}`);
  return (
    <Card
      className="task-card"
      data-blocked={task.block.blocked || undefined}
      onClick={(event) => openCardBody(event, href)}
    >
      <a
        className="task-card-main"
        aria-label={task.title}
        href={href}
        onClick={openCardLink}
      >
        <CardHeader>
          <CardTitle>{task.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="task-current-summary">
            {task.currentSummary || "Sem atualização registrada"}
          </p>
          {task.block.blocked && (
            <Badge variant="destructive">
              <LockKeyhole />
              Bloqueada
            </Badge>
          )}
          <div className="progress-line">
            <progress
              max={100}
              value={task.progress.percent}
              aria-label={`Progresso de ${task.title}`}
            />
            <span>{task.progress.percent}%</span>
          </div>
        </CardContent>
      </a>
      <CardFooter className="justify-between gap-2">
        <AgentName id={task.executorAgentId} avatar />
        {task.childSummary.total > 0 && (
          <span className="check-count">
            <CheckCheck size={14} />
            {task.childSummary.done}/{task.childSummary.total}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
