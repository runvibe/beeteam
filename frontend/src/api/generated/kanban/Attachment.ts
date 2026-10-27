// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Attachment = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  taskId: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description: string;
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
