// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type Block =
  | {
      /** @constant */
      blocked: true;
      reason: string;
    }
  | {
      /** @constant */
      blocked: false;
      reason: null;
    };
