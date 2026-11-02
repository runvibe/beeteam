// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskUsage = {
  knownTotalTokens: string | null;
  estimatedTotalTokens: string | null;
  measuredComponents: import("./UsageDelta").UsageDelta;
  coverage: import("./UsageCoverage").UsageCoverage;
  models: {
    items: import("./UsageDimension").UsageDimension[];
    total: number;
    offset: number;
    limit: number;
    truncated: boolean;
  };
  harnesses: {
    items: import("./UsageDimension").UsageDimension[];
    total: number;
    offset: number;
    limit: number;
    truncated: boolean;
  };
  timeline: {
    items: import("./SummaryUsageTimelineItem").SummaryUsageTimelineItem[];
    total: number;
    offset: number;
    limit: number;
    truncated: boolean;
  };
  recordedSessionUsage?: import("./RecordedSessionUsage").RecordedSessionUsage;
};
