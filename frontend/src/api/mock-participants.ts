import type { Database } from "./seed";
import type { TaskParticipant } from "./types";

/** In-memory demo adapter for the task-scoped participants contract. */
export function mockParticipants(
  db: Database,
  taskId: string,
): TaskParticipant[] {
  const ids = new Map<
    string,
    { actorKind: "human" | "agent"; actorId: string | null }
  >();
  const add = (actorKind: "human" | "agent", actorId: string | null) => {
    if (actorKind === "agent" && !actorId) return;
    const id = actorKind === "human" ? null : actorId;
    ids.set(`${actorKind}:${id}`, { actorKind, actorId: id });
  };
  const task = db.tasks.find((item) => item.id === taskId);
  if (task) {
    add("agent", task.authorAgentId);
    add("agent", task.executorAgentId);
  }
  for (const rows of [
    db.comments,
    db.plans,
    db.attachments,
    db.summaries,
    db.timeline,
  ]) {
    for (const row of rows)
      if (row.taskId === taskId && !row.deletedAt)
        add(row.actorKind, row.actorId);
  }
  for (const event of db.timeline) {
    if (event.taskId !== taskId || event.deletedAt) continue;
    const fields =
      event.type === "task.created"
        ? ["authorAgentId", "executorAgentId"]
        : event.type === "assignment.changed"
          ? ["previousExecutorAgentId", "executorAgentId"]
          : [];
    for (const field of fields) {
      const value = event.data?.[field];
      if (typeof value === "string") add("agent", value);
    }
  }
  return [...ids.values()]
    .sort((a, b) =>
      `${a.actorKind}:${a.actorId}`.localeCompare(
        `${b.actorKind}:${b.actorId}`,
      ),
    )
    .map((actor) => {
      const agent = db.agents.find((item) => item.id === actor.actorId);
      return {
        ...actor,
        agentName: agent?.name ?? null,
        agentArchived: !!agent?.archivedAt,
        agentDeleted: !!agent?.deletedAt,
      };
    });
}
