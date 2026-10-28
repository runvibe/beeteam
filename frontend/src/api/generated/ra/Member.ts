// Generated from contracts/ra-openapi.yaml. Do not edit.
export type Member = {
  /** Format: uuid */
  agentId: string;
  name: string;
  /** @enum {string} */
  role: "leader" | "collaborator";
  /** Format: date-time */
  agentArchivedAt: string | null;
};
