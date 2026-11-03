// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionTrackingEventPage = {
  items: import("./TaskExecutionTrackingEvent").TaskExecutionTrackingEvent[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};
