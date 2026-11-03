// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecution = {
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
  agentId: string;
  source: string;
  sessionId: string;
  coverageRootSessionId: string;
  scope: string;
  identity: unknown[];
  /** @enum {unknown} */
  counterMode: "global" | "per_model";
  /** @enum {unknown} */
  state: "active" | "paused" | "finished";
  /** Format: uuid */
  startSummaryId: string;
  endSummaryId: string | null;
  activeIntervalId: string | null;
};
