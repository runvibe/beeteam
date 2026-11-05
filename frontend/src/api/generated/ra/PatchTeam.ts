// Generated from contracts/ra-openapi.yaml. Do not edit.
export type PatchTeam = {
  leaderIconId?: import("./TeamRoleIconId").TeamRoleIconId;
  workerIconId?: import("./TeamRoleIconId").TeamRoleIconId;
  name?: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  purpose?: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  context?: string;
};
