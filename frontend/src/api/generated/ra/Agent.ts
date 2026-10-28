// Generated from contracts/ra-openapi.yaml. Do not edit.
export type Agent = {
  slug: import("./Slug").Slug;
  /** Format: uuid */
  id: string;
  name: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  roleDescription: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  workStyle: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  workInstructions: string;
  rules: string[];
  accessLimits: string[];
  image: import("./Image").Image;
  bindings: import("./RoleBindings").RoleBindings;
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
  /** @description Resumo de contexto fornecido explicitamente, não transcrição nem cópia automática de histórico. */
  contextSummary: string;
};
