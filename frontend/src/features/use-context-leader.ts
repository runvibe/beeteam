import { useEntity } from "@/api/context";
import { useUi } from "@/state/ui";
import { useChatPanel } from "@/state/chat-panel";

function available<T extends { archivedAt: string | null; deletedAt: string | null }>(row: T | undefined): row is T {
  return !!row && !row.archivedAt && !row.deletedAt;
}

/** Route aliases are resolved by useUi; every downstream lookup uses an entity ID. */
export function useContextLeader(currentLeaderId: string) {
  const ui = useUi();
  const visible = useChatPanel(state => state.contentOpen);
  const task = useEntity("tasks", visible ? ui.taskId ?? "" : "");
  const activeTask = !task.isError && available(task.data) ? task.data : undefined;
  const board = useEntity("boards", visible ? ui.boardId ?? activeTask?.boardId ?? "" : "");
  const activeBoard = !board.isError && available(board.data) ? board.data : undefined;
  const team = useEntity("teams", visible ? ui.teamId ?? activeBoard?.teamId ?? "" : "");
  const activeTeam = !team.isError && available(team.data) ? team.data : undefined;
  const leader = useEntity("agents", activeTeam?.leaderId ?? "");
  const activeLeader = !leader.isError && available(leader.data) ? leader.data : undefined;
  const context = ui.taskId ? activeTask : ui.boardId ? activeBoard : ui.teamId ? activeTeam : undefined;
  if (!visible || !context || !activeTeam || !activeLeader || activeLeader.id === currentLeaderId) return null;
  return {
    key: `${ui.taskId ? "task" : ui.boardId ? "board" : "team"}:${context.id}`,
    name: "title" in context ? context.title : context.name,
    team: activeTeam,
    leader: activeLeader,
  };
}
