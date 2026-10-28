// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type ReviewContext = {
  /** @enum {string} */
  reviewerType: "user" | "team_leader";
  conversationRef: string;
  instructionRef: string;
};
