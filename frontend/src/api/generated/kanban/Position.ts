// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Position = {
  currentSummary?: import("./CurrentSummaryInput").CurrentSummaryInput;
  /** Format: uuid */
  statusId: string;
  /** Format: uuid */
  beforeTaskId: string | null;
};
