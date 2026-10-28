// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskExecutionContext = {
  /** Format: uuid */
  rootTaskId: string;
  /** Format: uuid */
  originBoardId: string;
  originBoardMode: import("./BoardAutonomyMode").BoardAutonomyMode;
  /** @enum {string} */
  effectiveMode: "manual" | "automatic";
};
