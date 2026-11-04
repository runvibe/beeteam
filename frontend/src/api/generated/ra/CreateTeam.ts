// Generated from contracts/ra-openapi.yaml. Do not edit.
export type CreateTeam = {
  leaderIconId?: import("./TeamRoleIconId").TeamRoleIconId;
  collaboratorIconId?: import("./TeamRoleIconId").TeamRoleIconId;
  name: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  purpose?: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  context?: string;
  /** Format: uuid */
  leaderId: string;
  collaboratorIds?: string[];
  coordinationContext: import("./ApprovalCoordinationContext").ApprovalCoordinationContext;
};
