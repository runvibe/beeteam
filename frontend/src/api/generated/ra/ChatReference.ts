// Generated from contracts/ra-openapi.yaml. Do not edit.
export type ChatReference = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  agentId: string;
  harness: string;
  externalId: string;
  /** Format: uri */
  url: string | null;
  label: string;
  /** Format: date-time */
  archivedAt: string | null;
  version: number;
  /** Format: uuid */
  createdByActorId: string | null;
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  updatedAt: string;
  /**
   * Format: date-time
   * @description Exclusão lógica: corresponde a deleted_at no PostgreSQL; não remove dados físicos.
   */
  deletedAt: string | null;
  /** @enum {string} */
  actorKind: "human" | "agent";
};
