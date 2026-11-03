// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type PatchTask = {
  workScope?: import("./TaskWorkScope").TaskWorkScope;
  title?: string;
  specification?: import("./TaskSpecification").TaskSpecification;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description?: string;
  currentSummary?: import("./CurrentSummaryInput").CurrentSummaryInput;
  progress?: import("./Progress").Progress;
  autonomyMode?: import("./TaskAutonomyMode").TaskAutonomyMode;
};
