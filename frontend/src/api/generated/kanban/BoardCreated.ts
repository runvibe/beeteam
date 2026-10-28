// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type BoardCreated = {
  /** Format: uuid */
  id: string;
  name: string;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description: string;
  /** Format: date-time */
  archivedAt: string | null;
  version: number;
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  updatedAt: string;
  statuses: import("./Status").Status[];
  /**
   * Format: date-time
   * @description Exclusão lógica: corresponde a deleted_at no PostgreSQL; não remove dados físicos.
   */
  deletedAt: string | null;
  autonomyMode: import("./BoardAutonomyMode").BoardAutonomyMode;
  createdBy: import("./DeclaredActor").DeclaredActor;
  /**
   * Format: uuid
   * @description Time gestor do board; pode mudar sem alterar criador, tasks, executores, hierarquia ou histórico.
   */
  teamId: string;
  /** @description Último evento de transferência; log completo append-only preservado. Null antes da primeira transferência. */
  lastManagementChange:
    import("./BoardManagementChange").BoardManagementChange | null;
};
