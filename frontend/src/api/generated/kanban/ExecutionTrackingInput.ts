// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ExecutionTrackingInput = {
  /** @enum {unknown} */
  action: "start" | "checkpoint" | "pause" | "resume" | "finish";
  /** Format: uuid */
  executionId?: string;
  /** Format: uuid */
  intervalId?: string;
  evidenceIds: string[];
  /** @enum {unknown} */
  counterMode?: "global" | "per_model";
  coverageRootSessionId?: string;
  reason?: string;
  coverageLost?: boolean;
};
