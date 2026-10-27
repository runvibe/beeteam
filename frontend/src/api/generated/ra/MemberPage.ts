// Generated from contracts/ra-openapi.yaml. Do not edit.
export type MemberPage = {
  items: import("./Member").Member[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};
