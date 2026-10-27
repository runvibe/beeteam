// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type CreateTask = {
  title: string;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description?: string;
  /** Format: uuid */
  parentId?: string | null;
  /** Format: uuid */
  executorAgentId: string;
  /** Format: uuid */
  statusId?: string;
  coordinationContext: import("./CoordinationContext").CoordinationContext;
  autonomyMode?: import("./TaskAutonomyMode").TaskAutonomyMode;
  /** Format: uuid */
  authorAgentId: string;
};
