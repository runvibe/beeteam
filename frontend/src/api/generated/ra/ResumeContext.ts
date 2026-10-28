// Generated from contracts/ra-openapi.yaml. Do not edit.
export type ResumeContext = {
  agent: import("./Agent").Agent;
  teamContexts: {
    /** Format: uuid */
    teamId: string;
    /** @enum {string} */
    role: "leader" | "collaborator";
    name: string;
    /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
    purpose: string;
    /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
    context: string;
  }[];
  activityIndexPath: string;
  chatReferencesPath: string;
  taskIds: string[];
  /** Format: date-time */
  generatedAt: string;
  notice: string;
};
