import { useQuery } from "@tanstack/react-query";
import { useApi, useEntity } from "@/api/context";
import type { Task } from "@/api/types";
import { useUi } from "@/state/ui";

export function AppPath() {
  const { area, boardId, setArea } = useUi();
  const board = useEntity("boards", boardId ?? "");
  const label = { boards: "Boards", agents: "Agentes", teams: "Times" }[area];
  return (
    <nav aria-label="Caminho" className="context-path">
      <ol>
        <li>
          <button onClick={() => setArea("boards")}>Bee Team</button>
        </li>
        <li>
          {boardId && area === "boards" ? (
            <button onClick={() => setArea("boards")}>{label}</button>
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

export function TaskPath({ task }: { task: Task }) {
  const api = useApi();
  const open = useUi((s) => s.openTask);
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
  const originBoardId = ancestors.data?.[0]?.boardId ?? task.boardId;
  const originBoard = useEntity("boards", originBoardId);
  return (
    <nav aria-label="Caminho da task" className="context-path task-path">
      <ol>
        <li>
          <span>{originBoard.data?.name ?? "Board de origem"}</span>
        </li>
        {ancestors.data?.map((parent) => (
          <li key={parent.id}>
            <button onClick={() => open(parent.id)} title={parent.title}>
              {parent.title}
            </button>
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
