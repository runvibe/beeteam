// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Event = {
  /** Format: uuid */
  id: string;
  sequence: number;
  /** Format: uuid */
  taskId: string;
  type: import("./EventType").EventType;
  /** Format: uuid */
  actorId: string | null;
  /** Format: date-time */
  occurredAt: string;
  /** @description Dados relevantes anteriores/novos e IDs relacionados. comment.created traz commentId, sem duplicar corpo. */
  data: {
    [key: string]: unknown;
  };
  /**
   * Format: date-time
   * @description Exclusão lógica: corresponde a deleted_at no PostgreSQL; não remove dados físicos.
   */
  deletedAt: string | null;
  /** @enum {string} */
  actorKind: "human" | "agent";
};
