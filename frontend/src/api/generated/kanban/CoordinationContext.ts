// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type CoordinationContext =
  | {
      /** @constant */
      mode: "manual";
      conversationRef: string;
      approvalRef: string;
    }
  | {
      /** @constant */
      mode: "automatic";
      conversationRef: string;
    };
