import { message } from "@/i18n";
import type { Database } from "./seed";
import type { OverviewFeed, TaskOverviewData } from "./task-overview";
import { ApiError } from "./types";
export function mockOverview(db: Database, id: string): TaskOverviewData {
  const task = db.tasks.find((row) => row.id === id && !row.deletedAt);
  if (!task)
    throw new ApiError(404, "not_found", message("errors.taskNotFound"));
  const children = db.tasks.filter(
    (row) => row.parentId === id && !row.deletedAt,
  );
  const done = (statusId: string) =>
    !!db.statuses.find((row) => row.id === statusId)?.isDone;
  const byStatus = [...new Set(children.map((row) => row.statusId))].map(
    (statusId) => {
      const rows = children.filter((row) => row.statusId === statusId),
        status = db.statuses.find((row) => row.id === statusId);
      return {
        boardId: rows[0].boardId,
        boardName:
          db.boards.find((board) => board.id === rows[0].boardId)?.name ?? null,
        statusId,
        statusName: status?.name ?? statusId,
        isDone: done(statusId),
        total: rows.length,
        blocked: rows.filter((row) => row.block.blocked).length,
        color: null,
      };
    },
  );
  const byExecutor = [
    ...new Set(children.map((row) => row.executorAgentId)),
  ].map((executorAgentId) => {
    const rows = children.filter(
        (row) => row.executorAgentId === executorAgentId,
      ),
      completed = rows.filter((row) => done(row.statusId)).length;
    return {
      executorAgentId,
      agentName:
        db.agents.find((row) => row.id === executorAgentId)?.name ?? null,
      total: rows.length,
      done: completed,
      remaining: rows.length - completed,
    };
  });
  const feed = <T>(items: T[], limit: number): OverviewFeed<T> => ({
    items: items.slice(0, limit),
    total: items.length,
    limit,
    truncated: items.length > limit,
  });
  const summaries = db.summaries
    .filter((row) => row.taskId === id && !row.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = db.timeline
    .filter((row) => row.taskId === id && !row.deletedAt)
    .sort((a, b) => b.sequence - a.sequence);
  const history = events.flatMap((event) => {
    if (event.type !== "task.updated") return [];
    const progress = (event.data.progress ??
      (event.data.changes as Record<string, unknown> | undefined)?.progress) as
      { percent?: unknown; note?: unknown } | undefined;
    return progress && typeof progress.percent === "number"
      ? [
          {
            eventId: event.id,
            occurredAt: event.occurredAt,
            actorKind: event.actorKind,
            actorId: event.actorId,
            percent: progress.percent,
            note: typeof progress.note === "string" ? progress.note : "",
            source: event.type,
          },
        ]
      : [];
  });
  const synthesis = (event: (typeof events)[number]) =>
    event.data.currentSummary ??
    (event.data.changes as Record<string, unknown> | undefined)?.currentSummary;
  const latestSynthesis = events.find(
    (event) => typeof synthesis(event) === "string",
  );
  const summaryEvent =
    latestSynthesis && synthesis(latestSynthesis) === task.currentSummary
      ? latestSynthesis
      : undefined;
  const completed = children.filter((row) => done(row.statusId)).length;
  return {
    task,
    directSubtasks: {
      archivedIncluded: true,
      total: children.length,
      done: completed,
      remaining: children.length - completed,
      blocked: children.filter((row) => row.block.blocked).length,
      byStatus,
      byExecutor,
    },
    progressHistory: {
      ...feed(history, 100),
      items: history.slice(0, 100).reverse(),
      coverage: "explicit_progress_events_only",
    },
    currentSummaryMeta: summaryEvent
      ? {
          eventId: summaryEvent.id,
          occurredAt: summaryEvent.occurredAt,
          actorKind: summaryEvent.actorKind,
          actorId: summaryEvent.actorId,
        }
      : null,
    nextStep: null,
    decisions: [],
    latestExecutionSummary: summaries[0] ?? null,
    latestDeliverables: feed(
      summaries.flatMap((summary) =>
        summary.deliverables.map((deliverable) => ({
          summaryId: summary.id,
          createdAt: summary.createdAt,
          actorKind: summary.actorKind,
          actorId: summary.actorId,
          deliverable,
        })),
      ),
      10,
    ),
    latestAttachments: feed(
      db.attachments
        .filter((row) => row.taskId === id && !row.deletedAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      5,
    ),
    recentEvents: feed(events, 20),
  };
}
