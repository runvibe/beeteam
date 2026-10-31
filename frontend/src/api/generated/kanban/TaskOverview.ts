// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskOverview = {
  task: import("./Task").Task;
  directSubtasks: {
    total: number;
    done: number;
    remaining: number;
    blocked: number;
    /** @constant */
    archivedIncluded: true;
    byStatus: {
      /** Format: uuid */
      boardId: string;
      boardName: string | null;
      /** Format: uuid */
      statusId: string;
      statusName: string;
      isDone: boolean;
      total: number;
      blocked: number;
      color: null;
    }[];
    byExecutor: {
      /** Format: uuid */
      executorAgentId: string;
      agentName: string | null;
      total: number;
      done: number;
      remaining: number;
    }[];
  };
  progressHistory: {
    items: {
      /** Format: uuid */
      eventId: string;
      /** Format: date-time */
      occurredAt: string;
      /** @enum {string} */
      actorKind: "human" | "agent";
      /** Format: uuid */
      actorId: string | null;
      percent: number;
      note: string;
      /** @constant */
      source: "task.updated";
    }[];
    total: number;
    /** @constant */
    limit: 100;
    truncated: boolean;
    /** @constant */
    coverage: "explicit_progress_events_only";
  };
  currentSummaryMeta: {
    /** Format: uuid */
    eventId: string;
    /** Format: date-time */
    occurredAt: string;
    /** @enum {string} */
    actorKind: "human" | "agent";
    /** Format: uuid */
    actorId: string | null;
  } | null;
  latestExecutionSummary: import("./ExecutionSummary").ExecutionSummary | null;
  latestDeliverables: {
    items: {
      /** Format: uuid */
      summaryId: string;
      /** Format: date-time */
      createdAt: string;
      /** @enum {string} */
      actorKind: "human" | "agent";
      /** Format: uuid */
      actorId: string | null;
      deliverable: import("./Deliverable").Deliverable;
    }[];
    total: number;
    /** @constant */
    limit: 10;
    truncated: boolean;
  };
  latestAttachments: {
    items: import("./Attachment").Attachment[];
    total: number;
    /** @constant */
    limit: 5;
    truncated: boolean;
  };
  recentEvents: {
    items: import("./Event").Event[];
    total: number;
    /** @constant */
    limit: 20;
    truncated: boolean;
  };
  nextStep: null;
  decisions: string[];
  usage: import("./TaskUsage").TaskUsage;
};
