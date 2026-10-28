// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Status = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  boardId: string;
  name: string;
  isDone: boolean;
  position: number;
  /** Format: date-time */
  archivedAt: string | null;
  version: number;
  /**
   * Format: date-time
   * @description Exclusão lógica: corresponde a deleted_at no PostgreSQL; não remove dados físicos.
   */
  deletedAt: string | null;
};
