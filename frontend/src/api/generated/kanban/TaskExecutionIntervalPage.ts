// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionIntervalPage = {
  items: import("./TaskExecutionInterval").TaskExecutionInterval[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};
