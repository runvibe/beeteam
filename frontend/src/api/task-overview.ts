import type { Task, Resources } from "./types";
import type { Deliverable } from "./generated/kanban/Deliverable";

export type OverviewActor = {
  actorKind: "agent" | "human";
  actorId: string | null;
};
export type OverviewFeed<T> = {
  items: T[];
  total: number;
  limit: number;
  truncated: boolean;
};
export type ProgressPoint = OverviewActor & {
  eventId: string;
  occurredAt: string;
  percent: number;
  note: string;
  source: string;
};
export type TaskOverviewData = {
  task: Task;
  directSubtasks: {
    archivedIncluded: boolean;
    total: number;
    done: number;
    remaining: number;
    blocked: number;
    byStatus: {
      boardId: string;
      boardName: string | null;
      statusId: string;
      statusName: string;
      isDone: boolean;
      total: number;
      blocked: number;
      color: string | null;
    }[];
    byExecutor: {
      executorAgentId: string;
      agentName: string | null;
      total: number;
      done: number;
      remaining: number;
    }[];
  };
  progressHistory: OverviewFeed<ProgressPoint> & { coverage: string };
  currentSummaryMeta:
    (OverviewActor & { eventId: string; occurredAt: string }) | null;
  nextStep: string | null;
  decisions: string[];
  latestExecutionSummary: Resources["summaries"] | null;
  latestDeliverables: OverviewFeed<
    OverviewActor & {
      summaryId: string;
      createdAt: string;
      deliverable: Deliverable;
    }
  >;
  latestAttachments: OverviewFeed<Resources["attachments"]>;
  recentEvents: OverviewFeed<Resources["timeline"]>;
};
