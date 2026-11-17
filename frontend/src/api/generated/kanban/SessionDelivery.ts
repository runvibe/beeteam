// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type SessionDelivery = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  taskId: string;
  /** Format: uuid */
  commentId: string;
  /** Format: uuid */
  sourceId: string;
  /** Format: uuid */
  targetAgentId: string;
  /** Format: uuid */
  bindingId: string | null;
  /** Format: uuid */
  requesterAgentId?: string | null;
  /** Format: uuid */
  originBindingId?: string | null;
  /** Format: uuid */
  replyCommentId: string | null;
  /** @enum {string} */
  kind: "mention" | "worker_summary" | "response";
  /** @enum {string} */
  state:
    | "managed"
    | "managed_backpressure"
    | "cancelled"
    | "waiting_external"
    | "waiting_binding"
    | "pending"
    | "dispatching"
    | "acknowledged"
    | "completed"
    | "failed"
    | "uncertain"
    | "superseded";
  turnId: string | null;
  errorCode: string | null;
  expectsReply: boolean;
  version: number;
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  updatedAt: string;
  /**
   * Format: uri
   * @description Verified local Bee Team MCP origin for the provider turn; absent until preflight passes.
   */
  backendOrigin?: string;
};
