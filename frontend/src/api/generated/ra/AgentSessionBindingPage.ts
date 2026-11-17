// Generated from contracts/ra-openapi.yaml. Do not edit.
export type AgentSessionBindingPage = {
  items: import("./AgentSessionBinding").AgentSessionBinding[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};
