// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type ToolActivity = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  turnId: string;
  name: string;
  /** @enum {string} */
  status: "running" | "completed" | "failed";
  summary: string;
  revision: number;
};
