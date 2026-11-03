// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ExecutionSummary = {
  commitReport?: import("./CommitReport").CommitReport;
  executionTracking?: import("./ExecutionTrackingResult").ExecutionTrackingResult;
  usageReport?: import("./SummaryUsageReport").SummaryUsageReport | null;
  statusObserved?: import("./UsageObservedStatus").UsageObservedStatus;
  version?: number;
  /** @description Máximo 16384 bytes UTF-8. */
  summary: string;
  /** @enum {string} */
  outcome: "progress" | "completed" | "blocked";
  /** Format: uuid */
  statusId: string;
  deliverables: import("./Deliverable").Deliverable[];
  pending: string[];
  reviewContext: import("./ReviewContext").ReviewContext | null;
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  taskId: string;
  /** Format: uuid */
  actorId: string | null;
  /** Format: date-time */
  createdAt: string;
  /**
   * Format: date-time
   * @description Exclusão lógica: corresponde a deleted_at no PostgreSQL; não remove dados físicos.
   */
  deletedAt: string | null;
  /** @enum {string} */
  actorKind: "human" | "agent";
  executionContext: import("./ExecutionContextRef").ExecutionContextRef;
};
