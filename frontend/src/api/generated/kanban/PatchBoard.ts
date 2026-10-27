// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type PatchBoard = {
  name?: string;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description?: string;
  archived?: boolean;
  autonomyMode?: import("./BoardAutonomyMode").BoardAutonomyMode;
  /**
   * Format: uuid
   * @description Time gestor do board; pode mudar sem alterar criador, tasks, executores, hierarquia ou histórico.
   */
  teamId?: string;
};
