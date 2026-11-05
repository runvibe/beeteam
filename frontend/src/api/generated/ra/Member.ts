// Generated from contracts/ra-openapi.yaml. Do not edit.
export type Member = {
  /** Format: uuid */
  agentId: string;
  name: string;
  /** @enum {string} */
  role: "leader" | "worker";
  /** Format: date-time */
  agentArchivedAt: string | null;
};
