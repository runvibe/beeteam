// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type PlanRevision = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  planId: string;
  /** Format: uuid */
  taskId: string;
  title: string;
  revision: number;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  content: string;
  changeSummary: string | null;
  /** Format: uuid */
  actorId: string | null;
  /** Format: date-time */
  createdAt: string;
  /**
   * Format: date-time
   * @description Exclusão lógica: corresponde a deleted_at no PostgreSQL; não remove dados físicos.
   */
  deletedAt: string | null;
  /** @enum {string} */
  actorKind: "human" | "agent";
};
