// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Task = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  boardId: string;
  /** Format: uuid */
  parentId: string | null;
  title: string;
  specification: import("./TaskSpecification").TaskSpecification;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description: string;
  /**
   * Format: uuid
   * @description Executor obrigatório, reatribuível pelo usuário, sem restrição de time.
   */
  executorAgentId: string;
  /** Format: uuid */
  statusId: string;
  /** @description Rank opaco gerado pelo servidor. */
  position: string;
  currentSummary: import("./CurrentSummary").CurrentSummary;
  progress: import("./Progress").Progress;
  block: import("./Block").Block;
  childSummary: {
    total: number;
    done: number;
  };
  /** Format: uuid */
  latestExecutionSummaryId: string | null;
  /** Format: date-time */
  archivedAt: string | null;
  version: number;
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  updatedAt: string;
  /**
   * Format: date-time
   * @description Exclusão lógica: corresponde a deleted_at no PostgreSQL; não remove dados físicos.
   */
  deletedAt: string | null;
  autonomyMode: import("./TaskAutonomyMode").TaskAutonomyMode;
  executionContext: import("./TaskExecutionContext").TaskExecutionContext;
  /**
   * Format: uuid
   * @description Autor/dono obrigatório e imutável; agente que escreveu a task. Independente do ator declarado que transporta a requisição.
   */
  authorAgentId: string;
};
