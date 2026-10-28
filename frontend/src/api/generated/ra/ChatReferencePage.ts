// Generated from contracts/ra-openapi.yaml. Do not edit.
export type ChatReferencePage = {
  items: import("./ChatReference").ChatReference[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};
