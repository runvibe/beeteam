// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type CreateComment = {
  /** @description Máximo 16384 bytes UTF-8. */
  body: string;
  /** @description Explicit stable recipient IDs selected from the task board team. Display names and body text never select a managed destination. */
  mentionedAgentIds?: string[];
};
