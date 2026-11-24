// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type Message = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  chatId: string;
  /** Format: uuid */
  turnId: string;
  /**
   * @description system is a read-only Conversation notice, never a human-authored prompt.
   * @enum {string}
   */
  role: "user" | "assistant" | "system";
  content: string;
  revision: number;
  taskId: string | null;
  clientMessageId: string | null;
  /** Format: date-time */
  createdAt: string;
};
