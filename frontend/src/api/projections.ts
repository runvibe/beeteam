import { message } from "@/i18n";
import type { Database } from "./seed";
import type { Task } from "./types";
import { ApiError } from "./types";
/** Walks persisted parent links iteratively; no arbitrary depth cap. */
export function projectTask(task: Task, db: Database): Task {
  let root = task;
  const seen = new Set<string>();
  while (root.parentId) {
    if (seen.has(root.id))
      throw new ApiError(
        409,
        "hierarchy_cycle",
        message("errors.hierarchyCycle"),
      );
    seen.add(root.id);
    const parent = db.tasks.find((t) => t.id === root.parentId);
    if (!parent)
      throw new ApiError(
        409,
        "invalid_hierarchy",
        message("errors.parentTaskNotFound"),
      );
    root = parent;
  }
  const board = db.boards.find((b) => b.id === root.boardId);
  if (!board)
    throw new ApiError(
      409,
      "invalid_hierarchy",
      message("errors.originBoardNotFound"),
    );
  const children = db.tasks.filter(
    (t) => t.parentId === task.id && !t.deletedAt,
  );
  const parent = db.tasks.find((row) => row.id === task.parentId);
  return {
    ...task,
    parentReference: parent
      ? { id: parent.id, title: parent.title, slug: parent.slug }
      : null,
    childSummary: {
      total: children.length,
      done: children.filter(
        (c) => db.statuses.find((s) => s.id === c.statusId)?.isDone,
      ).length,
    },
    executionContext: {
      rootTaskId: root.id,
      originBoardId: root.boardId,
      originBoardMode: board.autonomyMode,
      effectiveMode:
        board.autonomyMode === "standard"
          ? task.autonomyMode
          : board.autonomyMode,
    },
  };
}
export function descendantIds(taskId: string, db: Database): Set<string> {
  const found = new Set([taskId]),
    queue = [taskId];
  for (let i = 0; i < queue.length; i++)
    for (const task of db.tasks) {
      if (task.parentId === queue[i] && !found.has(task.id)) {
        found.add(task.id);
        queue.push(task.id);
      }
    }
  return found;
}
