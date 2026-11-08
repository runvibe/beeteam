// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type SendMessage = {
  /** Format: uuid */
  clientMessageId: string;
  /** Format: uuid */
  bindingId: string;
  /** @description Non-whitespace Markdown, additionally limited to 65536 UTF-8 bytes. */
  content: string;
  taskId?: string | null;
};
