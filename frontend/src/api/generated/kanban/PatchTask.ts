// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type PatchTask = {
  title?: string;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description?: string;
  progress?: import("./Progress").Progress;
  autonomyMode?: import("./TaskAutonomyMode").TaskAutonomyMode;
};
