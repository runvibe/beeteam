// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionInterval = {
  /** Format: uuid */
  id: string;
  version: number;
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  /** Format: uuid */
  taskId: string;
  /** Format: uuid */
  executionId: string;
  /** Format: uuid */
  agentId: string;
  source: string;
  sessionId: string;
  coverageRootSessionId: string;
  scope: string;
  counterMode: string;
  /** @enum {unknown} */
  state: "open" | "closed" | "incomplete" | "invalid";
  /** Format: uuid */
  startSummaryId: string;
  endSummaryId: string | null;
  /** Format: date-time */
  startObservedAt: string;
  endObservedAt: string | null;
  /** Format: date-time */
  latestObservedAt: string;
  /** Format: date-time */
  startReceivedAt: string;
  endReceivedAt: string | null;
  counters: import("./ExecutionIntervalCounter").ExecutionIntervalCounter[];
  models: string[];
  revision: number;
  reason: string | null;
  coverageLost: boolean;
  /** @enum {unknown} */
  coverage: "open" | "complete" | "incomplete" | "invalid";
  totalTokens: string | null;
  partialTokens: string | null;
  observedDurationMs: string | null;
};
