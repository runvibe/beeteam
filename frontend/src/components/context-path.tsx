import { useLocale, t as tr } from "@/i18n";

import { openCardLink } from "@/routing/card-navigation";
import {
  destination,
  demoHref,
  navigate,
  safeOrigin,
  useLocation,
} from "@/routing/location";
import { useQuery } from "@tanstack/react-query";
import { useApi, useEntity } from "@/api/context";
import type { Task } from "@/api/types";
import { useUi } from "@/state/ui";

export function AppPath() {
  useLocale();
  const { area, boardId, taskId, agentId, teamId, setArea } = useUi();
  const board = useEntity("boards", boardId ?? "");
  const task = useEntity("tasks", taskId ?? "");
  const agent = useEntity("agents", agentId ?? "");
  const team = useEntity("teams", teamId ?? "");
  const routePath = useLocation().split("?")[0];
  const configuring = routePath.endsWith("/settings");
  const [, routeKind, routeKey] = routePath.split("/");
  if (
    routeKey &&
    ["agents", "teams", "tasks"].includes(routeKind) &&
    !agentId &&
    !teamId &&
    !taskId
  ) {
    const root = routeKind === "tasks" ? "boards" : routeKind;
    return (
      <nav aria-label={tr("common.path")} className="context-path">
        <ol>
          <li>
            <a
              href={demoHref(findOrigin(`/${root}`) ?? `/${root}`)}
              onClick={openCardLink}
            >
              {root === "boards"
                ? tr("common.boards")
                : root === "agents"
                  ? tr("common.agents")
                  : tr("common.teams")}
            </a>
          </li>
          <li>
            <span aria-current="page">{tr("common.loading")}</span>
          </li>
        </ol>
      </nav>
    );
  }
  if (agentId || teamId) {
    const resource = agentId ? "agents" : "teams";
    const id = (agentId ? agent.data : team.data)?.slug ?? agentId ?? teamId;
    const name =
      (agentId ? agent.data : team.data)?.name ?? tr("common.loading");
    return (
      <nav aria-label={tr("common.path")} className="context-path">
        <ol>
          <li>
            <a
              href={demoHref(findOrigin(`/${resource}`) ?? `/${resource}`)}
              onClick={openCardLink}
            >
              {agentId ? tr("common.agents") : tr("common.teams")}
            </a>
          </li>
          <li>
            {configuring ? (
              <a
                href={`/${resource}/${id}${location.search}`}
                onClick={openCardLink}
              >
                {name}
              </a>
            ) : (
              <span aria-current="page">{name}</span>
            )}
          </li>
          {configuring && (
            <li>
              <span aria-current="page">{tr("common.settings")}</span>
            </li>
          )}
        </ol>
      </nav>
    );
  }
  const listOrigin = findOrigin("/boards") ?? "/boards";
  if (taskId)
    return task.data ? (
      <TaskPath task={task.data} shell />
    ) : (
      <nav aria-label={tr("common.path")} className="context-path">
        <ol>
          <li>
            <a href={demoHref(listOrigin)} onClick={openCardLink}>
              {tr("common.boards")}
            </a>
          </li>
          <li>
            <span aria-current="page">{tr("common.loadingTask")}</span>
          </li>
        </ol>
      </nav>
    );
  /* origin search is shared with task ancestors */
  const label = {
    home: tr("common.home"),
    boards: tr("common.boards"),
    agents: tr("common.agents"),
    teams: tr("common.teams"),
  }[area];
  return (
    <nav aria-label={tr("common.path")} className="context-path">
      <ol>
        <li>
          <button onClick={() => setArea("boards")}>Bee Team</button>
        </li>
        <li>
          {boardId && area === "boards" ? (
            <button onClick={() => navigate(listOrigin)}>{label}</button>
          ) : (
            <span aria-current="page">{label}</span>
          )}
        </li>
        {boardId && area === "boards" && (
          <li>
            <span aria-current="page">
              {board.data?.name ?? tr("common.board")}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}

function findOrigin(path: string): string | null {
  let candidate = safeOrigin(new URLSearchParams(location.search).get("from"));
  const seen = new Set<string>();
  while (candidate && !seen.has(candidate)) {
    seen.add(candidate);
    if (
      candidate.split("?")[0] === path ||
      (path === "/boards" && candidate.split("?")[0] === "/")
    )
      return candidate;
    candidate = safeOrigin(
      new URLSearchParams(candidate.split("?")[1]).get("from"),
    );
  }
  return null;
}
const contextHref = (path: string) => findOrigin(path) ?? destination(path);
export function TaskPath({
  task,
  shell = false,
}: {
  task: Task;
  shell?: boolean;
}) {
  useLocale();
  const api = useApi();
  const board = useEntity("boards", task.boardId);
  const ancestors = useQuery({
    queryKey: ["task-path", task.id, task.parentId],
    queryFn: async () => {
      const path: Task[] = [];
      const seen = new Set([task.id]);
      let id = task.parentId;
      while (id && !seen.has(id)) {
        seen.add(id);
        const parent = await api.get("tasks", id);
        path.unshift(parent);
        id = parent.parentId;
      }
      return path;
    },
  });
  const originBoardId = task.executionContext.originBoardId;
  const originBoard = useEntity("boards", originBoardId);
  return (
    <nav
      aria-label={shell ? tr("common.path") : tr("common.taskPath")}
      className={
        shell ? "context-path task-shell-path" : "context-path task-path"
      }
    >
      <ol>
        {shell && (
          <li>
            <a href={demoHref(findOrigin("/boards") ?? "/boards")} onClick={openCardLink}>
              {tr("common.boards")}
            </a>
          </li>
        )}
        <li>
          <a
            href={contextHref(`/boards/${originBoardId}`)}
            onClick={openCardLink}
          >
            {originBoard.data?.name ?? tr("common.originBoard")}
          </a>
        </li>
        {ancestors.data?.map((parent) => (
          <li key={parent.id}>
            <a
              href={contextHref(`/tasks/${parent.slug}`)}
              onClick={(event) => {
                if (
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  navigate(event.currentTarget.getAttribute("href")!);
                }
              }}
              title={parent.title}
            >
              {parent.title}
            </a>
          </li>
        ))}
        <li>
          <span aria-current="page" title={task.title}>
            {task.title}
          </span>
        </li>
      </ol>
      {originBoardId !== task.boardId && (
        <div className="small-note">
          {tr("common.currentBoard")}{" "}
          <span>{board.data?.name ?? tr("common.board")}</span>
        </div>
      )}
      {ancestors.error && (
        <span className="small-note">
          {tr("common.fullPathUnavailableUseParentTask")}
        </span>
      )}
    </nav>
  );
}
