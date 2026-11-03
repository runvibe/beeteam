// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionIntervalUsage = {
  validTotalTokens: string | null;
  partialTotalTokens: string | null;
  observedDurationMs: string | null;
  elapsedDurationMs: string | null;
  coverage: {
    totalIntervals: number;
    validIntervals: number;
    openIntervals: number;
    incompleteIntervals: number;
    invalidIntervals: number;
    untrackedSummaries: number;
  };
};
