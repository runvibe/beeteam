// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ExecutionIntervalCounter = {
  counterKey: string;
  incomplete: boolean;
  segments: import("./ExecutionCounterSegment").ExecutionCounterSegment[];
  missingBoundary?: boolean;
};
