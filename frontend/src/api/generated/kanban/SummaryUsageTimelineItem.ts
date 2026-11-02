// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type SummaryUsageTimelineItem = {
  /** Format: uuid */
  summaryId: string;
  /** Format: date-time */
  reportedAt: string;
  reportingActor: import("./DeclaredActor").DeclaredActor;
  statusObserved: import("./UsageObservedStatus").UsageObservedStatus | null;
  usageReport: import("./SummaryUsageReport").SummaryUsageReport | null;
  recordedSessionUsage?: import("./RecordedSessionUsage").RecordedSessionUsage;
};
