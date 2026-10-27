// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type RevisePlan = {
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  content: string;
  /** @description Máximo 16384 bytes UTF-8. */
  changeSummary: string;
  baseRevision: number;
};
