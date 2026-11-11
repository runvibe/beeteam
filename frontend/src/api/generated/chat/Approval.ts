// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type Approval = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  chatId: string;
  /** Format: uuid */
  turnId: string;
  /** Format: uuid */
  bindingId: string;
  /** Format: uuid */
  agentId: string;
  taskId: string | null;
  /** @enum {string} */
  kind: "command" | "file_change" | "network" | "mcp_tool";
  title: string;
  description: string;
  command: string | null;
  host: string | null;
  paths: string[];
  /** @enum {string} */
  status: "pending" | "accepted" | "declined" | "expired";
  version: number;
  /** Format: date-time */
  expiresAt: string;
};
