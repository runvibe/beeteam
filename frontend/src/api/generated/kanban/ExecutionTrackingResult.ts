// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ExecutionTrackingResult = {
  /** @enum {unknown} */
  action: "start" | "checkpoint" | "pause" | "resume" | "finish";
  /** Format: uuid */
  executionId: string;
  intervalId: string | null;
  /** @enum {unknown} */
  executionState: "active" | "paused" | "finished";
  intervalState: ("open" | "closed" | "incomplete" | "invalid") | null;
};
