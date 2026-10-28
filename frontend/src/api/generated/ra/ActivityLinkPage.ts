// Generated from contracts/ra-openapi.yaml. Do not edit.
export type ActivityLinkPage = {
  items: import("./ActivityLink").ActivityLink[];
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};
