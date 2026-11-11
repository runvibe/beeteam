import { formatPercent, formatNumber, useLocale, t as tr } from "@/i18n";

import {
  RecordedProgress,
  recordedPercent,
} from "@/components/recorded-progress";
import { TaskParentReference } from "@/components/task-parent-reference";
import { CardKindMark } from "@/components/card-kind-mark";
import { KanbanCarousel } from "@/components/kanban-carousel";
import { useColumnPages } from "@/api/column-pages";
import { KanbanColumnViewport } from "@/components/kanban-column-viewport";
import { CardSymbol } from "@/components/card-symbol";
import { RelativeTime } from "@/components/relative-time";
import { CardExcerpt } from "@/components/card-excerpt";
import { useCardPages } from "@/api/card-pages";
import { CardListViewport } from "@/components/card-list-viewport";
import { BalancedCardGrid } from "@/components/balanced-card-grid";
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
import { Settings, CheckCheck, LockKeyhole, ArrowUpLeft } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useApi, useEntity, useList } from "@/api/context";
import type { BoardView, Filters, Task } from "@/api/types";
import { useUi } from "@/state/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SystemBadge } from "@/components/system-badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Choice, Search, QueryState, NoData } from "@/components/shared";
import { AgentName } from "@/components/names";
import { BoardSettings } from "./settings";
export function Boards() {
  useLocale();
  const selected = useUi((s) => s.boardId);
  return selected ? (
    <BoardScreen key={selected} id={selected} />
  ) : (
    <BoardIndex />
  );
}
function BoardIndex() {
  useLocale();
  const [name, setName] = useUrlState<string>("boards.name", ""),
    [teamId, setTeam] = useUrlState<string>("boards.teamId", ""),
    [archived, setArchived] = useUrlState<string>("boards.archived", "false", {
      values: booleanValues,
    }),
    [offset, setOffset] = useUrlState<number>("boards.offset", 0);
  const limit = usePageSize("boards", 12);
  const q = useCardPages("boards", {
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
      <header className="page-heading listing-heading">
        <div className="sr-only">
          <h1>{tr("common.boards")}</h1>
          <p>{tr("boards.aViewOfTheWorkDecisionsAndWhatComesNext")}</p>
        </div>
        <FilterBar
          inHeader
          search={
            <>
              <Search
                value={name}
                onChange={(v) => {
                  setName(v);
                  setOffset(0);
                }}
                label={tr("boards.searchBoards")}
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
            label={tr("boards.managingTeam")}
            value={teamId}
            onChange={(v) => {
              setTeam(v);
              setOffset(0);
            }}
          />
          <Choice
            label={tr("agents.registry")}
            value={archived}
            onChange={(v) => {
              setArchived(v);
              setOffset(0);
            }}
            options={[
              { value: "false", label: tr("agents.active") },
              { value: "true", label: tr("agents.archived") },
            ]}
          />
        </FilterBar>
      </header>
      <CardListViewport
        key={q.identity}
        state={q}
        label={tr("boards.boardList")}
      >
        {q.items && (
          <>
            {q.items.length ? (
              <BalancedCardGrid className="board-grid">
                {q.items.map((b) => (
                  <a
                    key={b.id}
                    className="board-card-link"
                    aria-label={b.name}
                    href={destination(`/boards/${b.id}`)}
                    onClick={openCardLink}
                  >
                    <Card className="board-card">
                      <CardKindMark kind="board" />
                      <CardHeader>
                        <CardDescription>
                          {teams.data?.items.find((t) => t.id === b.teamId)
                            ?.name ?? tr("boards.managingTeam")}
                        </CardDescription>
                        <CardTitle>{b.name}</CardTitle>
                        <SystemBadge system={b.system} />
                      </CardHeader>
                      <CardContent>
                        <CardExcerpt text={b.description} />
                      </CardContent>
                      <CardFooter className="justify-between gap-2">
                        <CardSymbol kind={b.autonomyMode} />
                        <span className="small-note">
                          <RelativeTime value={b.updatedAt} />
                        </span>
                      </CardFooter>
                    </Card>
                  </a>
                ))}
              </BalancedCardGrid>
            ) : (
              <NoData
                title={
                  name || teamId
                    ? tr("boards.noBoardsMatchTheFilters")
                    : tr("boards.noBoardsInThisRegistry")
                }
                description={tr("boards.adjustTheFiltersToBrowseOtherBoards")}
              />
            )}
          </>
        )}
      </CardListViewport>
    </>
  );
}
function BoardScreen({ id }: { id: string }) {
  useLocale();
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
    limit = Math.max(
      6,
      usePageSize(
        "kanban",
        Math.max(6, Math.ceil((innerHeight - 140) / 272) + 1),
      ),
    );
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
        {tr("common.back")}
      </Button>
      <QueryState query={entity}>
        {entity.data && (
          <header className="page-heading listing-heading">
            <div className="sr-only">
              <h1>{entity.data.name}</h1>
              <p>{entity.data.description}</p>
            </div>
            <div className="listing-heading-actions">
              <FilterBar
                inHeader
                trailingAction={
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="filter-icon"
                        aria-label={tr("boards.boardSettings")}
                        onClick={() => setSettings(true)}
                      >
                        <Settings aria-hidden="true" />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="navigation-tooltip"
                        sideOffset={6}
                      >
                        {tr("boards.boardSettings")}
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                }
                search={
                  <>
                    <Search
                      value={title}
                      onChange={setTitle}
                      label={tr("boards.searchTasks")}
                    />
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
                  label={tr("boards.executor")}
                  value={executor}
                  onChange={setExecutor}
                />
                <Choice
                  label={tr("boards.block")}
                  value={blocked}
                  onChange={setBlocked}
                  options={[
                    { value: "true", label: tr("boards.blocked") },
                    { value: "false", label: tr("boards.notBlocked") },
                  ]}
                  all={tr("agents.all")}
                />
                <FilterPopover
                  label={tr("boards.updatedSince")}
                  active={!!updatedFrom}
                  summary={updatedFrom}
                  onClear={() => setUpdatedFrom("")}
                >
                  <label className="date-filter">
                    {tr("boards.updatedSince")}
                    <input
                      aria-label={tr("boards.updatedSince")}
                      type="date"
                      value={updatedFrom}
                      onChange={(e) => setUpdatedFrom(e.target.value)}
                    />
                  </label>
                </FilterPopover>
              </FilterBar>
            </div>
          </header>
        )}
      </QueryState>

      <QueryState query={q}>
        {q.data && (
          <KanbanCarousel
            key={JSON.stringify(filters)}
            columns={q.data.columns.map((c) => ({
              id: c.status.id,
              name: c.status.name,
              total: c.total,
            }))}
          >
            {q.data.columns.map((c) => (
              <Column
                key={c.status.id}
                boardId={id}
                column={c}
                filters={filters}
              />
            ))}
          </KanbanCarousel>
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
  useLocale();
  const page = useColumnPages(boardId, column, filters);
  return (
    <section className="kanban-column" aria-label={column.status.name}>
      <div className="column-heading">
        <span
          className={column.status.isDone ? "status-dot done" : "status-dot"}
        />
        <h2>{column.status.name}</h2>
        <span>{formatNumber(page.total)}</span>
      </div>
      <KanbanColumnViewport
        storageKey={JSON.stringify([boardId, column.status.id, filters])}
        state={page}
        label={column.status.name}
      >
        {page.items.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
        {page.items.length === 0 && (
          <NoData
            title={tr("boards.noTasks")}
            description={tr("boards.noTasksMatchThisColumn")}
          />
        )}
      </KanbanColumnViewport>
    </section>
  );
}
export function TaskCard({ task }: { task: Task }) {
  useLocale();
  const href = destination(`/tasks/${task.slug}`);
  return (
    <Card
      className="task-card"
      data-task-id={task.id}
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
          <CardExcerpt
            text={task.currentSummary || tr("boards.noUpdateRecorded")}
          />
          {task.block.blocked && (
            <Badge variant="destructive">
              <LockKeyhole />
              {tr("boards.blocked2")}
            </Badge>
          )}
          <div className="progress-line">
            <RecordedProgress
              percent={task.progress?.percent}
              label={tr("tasks.progressOf", { title: task.title })}
            />
            <span>
              {recordedPercent(task.progress?.percent) === undefined
                ? tr("tasks.noData")
                : formatPercent(recordedPercent(task.progress?.percent))}
            </span>
          </div>
        </CardContent>
      </a>
      <TaskParentReference task={task} />
      <CardFooter className="justify-between gap-2">
        <AgentName id={task.executorAgentId} avatar />
        {task.childSummary.total > 0 && (
          <span className="check-count">
            <CheckCheck size={14} />
            {formatNumber(task.childSummary.done)}/
            {formatNumber(task.childSummary.total)}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
