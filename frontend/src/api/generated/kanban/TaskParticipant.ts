// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskParticipant = {
  /** @enum {string} */
  actorKind: "human" | "agent";
  /** Format: uuid */
  actorId: string | null;
  agentName: string | null;
  agentArchived: boolean;
  agentDeleted: boolean;
};
