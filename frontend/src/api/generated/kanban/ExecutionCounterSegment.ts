// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ExecutionCounterSegment = {
  start: import("./UsageEntry").UsageEntry;
  latest: import("./UsageEntry").UsageEntry;
  /** Format: uuid */
  startSummaryId: string;
  /** Format: uuid */
  latestSummaryId: string;
  delta: import("./UsageDelta").UsageDelta | null;
  complete: boolean;
  reason: string | null;
};
