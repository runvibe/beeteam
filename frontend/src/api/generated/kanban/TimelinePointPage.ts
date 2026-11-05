// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TimelinePointPage = {
  items: import("./TimelinePoint").TimelinePoint[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};
