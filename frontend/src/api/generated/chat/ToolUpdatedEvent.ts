// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type ToolUpdatedEvent = {
  /** @constant */
  schemaVersion: 1;
  id: string;
  /** Format: uuid */
  chatId: string;
  /** Format: uuid */
  turnId: string;
  /** Format: date-time */
  createdAt: string;
  /**
   * @description discriminator enum property added by openapi-typescript
   * @enum {string}
   */
  type: "tool.updated";
  data: {
    tool: import("./ToolActivity").ToolActivity;
  };
};
