// Generated from contracts/ra-openapi.yaml. Do not edit.
export type TeamPage = {
  items: import("./Team").Team[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};
