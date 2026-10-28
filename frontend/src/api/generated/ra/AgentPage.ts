// Generated from contracts/ra-openapi.yaml. Do not edit.
export type AgentPage = {
  items: import("./Agent").Agent[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};
