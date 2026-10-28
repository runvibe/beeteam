// Generated from contracts/ra-openapi.yaml. Do not edit.
export type ActivityLink = {
  /** Format: uuid */
  taskId: string;
  /** Format: uuid */
  boardId: string;
  /** Format: uuid */
  parentId: string | null;
  title: string;
  /** Format: uuid */
  statusId: string;
  /** Format: uuid */
  executorAgentId: string;
  isCurrentExecutor: boolean;
  /** Format: date-time */
  lastWorkedAt: string | null;
  /** Format: date-time */
  taskUpdatedAt: string;
  /** Format: uuid */
  latestOwnSummaryId: string | null;
  taskPath: string;
  summariesPath: string;
  /** Format: uuid */
  authorAgentId: string;
};
