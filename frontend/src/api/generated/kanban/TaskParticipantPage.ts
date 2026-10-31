// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskParticipantPage = {
  items: import("./TaskParticipant").TaskParticipant[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};
