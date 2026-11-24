// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Comment = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  taskId: string;
  /** @description Máximo 16384 bytes UTF-8. */
  body: string;
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
  /** @description Explicit stable recipient IDs selected from the task board team. Display names and body text never select a managed destination. */
  mentionedAgentIds?: string[];
  /** Format: uuid */
  sourceSummaryId?: string;
  /** Format: uuid */
  inReplyToCommentId?: string;
  /** Format: uuid */
  deliveryId?: string;
};
