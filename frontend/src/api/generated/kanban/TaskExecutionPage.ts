// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionPage = {
  items: import("./TaskExecution").TaskExecution[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};
