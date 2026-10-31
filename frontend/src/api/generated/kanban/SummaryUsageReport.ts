// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type SummaryUsageReport = {
  /** Format: date-time */
  reportedAt: string;
  statusObserved: import("./UsageObservedStatus").UsageObservedStatus;
  reportingActor: import("./DeclaredActor").DeclaredActor;
  revision: number;
  entries: import("./UsageEntry").UsageEntry[];
  /** Format: date-time */
  reconciledAt?: string;
};
