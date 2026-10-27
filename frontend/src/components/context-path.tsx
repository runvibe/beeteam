import { openCardLink } from "@/routing/card-navigation";
import {
  destination,
  navigate,
  safeOrigin,
  useLocation,
} from "@/routing/location";
import { useQuery } from "@tanstack/react-query";
import { useApi, useEntity } from "@/api/context";
import type { Task } from "@/api/types";
import { useUi } from "@/state/ui";

export function AppPath() {
  const { area, boardId, taskId, agentId, teamId, setArea } = useUi();
  const board = useEntity("boards", boardId ?? "");
  const task = useEntity("tasks", taskId ?? "");
  const agent = useEntity("agents", agentId ?? "");
  const team = useEntity("teams", teamId ?? "");
  const configuring = useLocation().split("?")[0].endsWith("/settings");
  if (agentId || teamId) {
    const resource = agentId ? "agents" : "teams";
    const id = agentId ?? teamId;
    const name = (agentId ? agent.data : team.data)?.name ?? "Carregando…";
    return (
      <nav aria-label="Caminho" className="context-path">
        <ol>
          <li>
            <a
              href={findOrigin(`/${resource}`) ?? `/${resource}`}
              onClick={openCardLink}
            >
              {agentId ? "Agentes" : "Times"}
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
              <span aria-current="page">Configuração</span>
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
      <nav aria-label="Caminho" className="context-path">
        <ol>
          <li>
            <a href={listOrigin} onClick={openCardLink}>
              Boards
            </a>
          </li>
          <li>
            <span aria-current="page">Carregando task…</span>
          </li>
        </ol>
      </nav>
    );
  /* origin search is shared with task ancestors */
  const label = { boards: "Boards", agents: "Agentes", teams: "Times" }[area];
  return (
    <nav aria-label="Caminho" className="context-path">
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
            <span aria-current="page">{board.data?.name ?? "Board"}</span>
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
      aria-label={shell ? "Caminho" : "Caminho da task"}
      className={
        shell ? "context-path task-shell-path" : "context-path task-path"
      }
    >
      <ol>
        {shell && (
          <li>
            <a href={findOrigin("/boards") ?? "/boards"} onClick={openCardLink}>
              Boards
            </a>
          </li>
        )}
        <li>
          <a
            href={contextHref(`/boards/${originBoardId}`)}
            onClick={openCardLink}
          >
            {originBoard.data?.name ?? "Board de origem"}
          </a>
        </li>
        {ancestors.data?.map((parent) => (
          <li key={parent.id}>
            <a
              href={contextHref(`/tasks/${parent.id}`)}
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
          Board atual: <span>{board.data?.name ?? "Board"}</span>
        </div>
      )}
      {ancestors.error && (
        <span className="small-note">
          Caminho completo indisponível; use Task pai.
        </span>
      )}
    </nav>
  );
}
