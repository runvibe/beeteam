// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionTrackingEvent = {
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
  intervalId: string | null;
  action: string;
  /** Format: uuid */
  summaryId: string;
  statusObserved: import("./UsageObservedStatus").UsageObservedStatus;
  reportingActor: import("./DeclaredActor").DeclaredActor;
  observedAt: string | null;
  /** Format: date-time */
  receivedAt: string;
  source: string;
  sessionId: string;
  /** Format: uuid */
  agentId: string;
  models: string[];
  evidence: import("./UsageEntry").UsageEntry[];
  reason: string | null;
};
