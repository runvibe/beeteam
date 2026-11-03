// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionIntervalRevision = {
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
  intervalId: string;
  revision: number;
  reason: string;
  reportingActor: import("./DeclaredActor").DeclaredActor;
  interval: import("./TaskExecutionInterval").TaskExecutionInterval;
};
