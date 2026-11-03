// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionIntervalRevisionPage = {
  items: import("./TaskExecutionIntervalRevision").TaskExecutionIntervalRevision[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};
