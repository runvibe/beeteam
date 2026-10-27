// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type RecordExecution = {
  /** @description Máximo 16384 bytes UTF-8. */
  summary: string;
  /** @enum {string} */
  outcome: "progress" | "completed" | "blocked";
  /** Format: uuid */
  statusId: string;
  deliverables: import("./Deliverable").Deliverable[];
  pending: string[];
  reviewContext?: import("./ReviewContext").ReviewContext;
  progress?: import("./Progress").Progress;
  executionContext: import("./ExecutionContextRef").ExecutionContextRef;
};
