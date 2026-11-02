// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type RecordedSessionUsage = {
  measuredTotalTokens: string | null;
  estimatedTotalTokens: string | null;
  coverage: {
    sessions: number;
    baselineEntries: number;
    deltaEntries: number;
    duplicateEntries: number;
  };
};
