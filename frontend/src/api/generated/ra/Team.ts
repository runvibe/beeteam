// Generated from contracts/ra-openapi.yaml. Do not edit.
export type Team = {
  roleIcons?: import("./TeamRoleIcons").TeamRoleIcons;
  leaderIconId?: import("./TeamRoleIconId").TeamRoleIconId;
  workerIconId?: import("./TeamRoleIconId").TeamRoleIconId;
  slug: import("./Slug").Slug;
  /** Format: uuid */
  id: string;
  name: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  purpose: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  context: string;
  /** Format: uuid */
  leaderId: string;
  workerCount: number;
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
};
