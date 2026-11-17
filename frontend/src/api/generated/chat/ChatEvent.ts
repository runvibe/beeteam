// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type ChatEvent =
  | import("./MessageUpdatedEvent").MessageUpdatedEvent
  | import("./TurnUpdatedEvent").TurnUpdatedEvent
  | import("./ToolUpdatedEvent").ToolUpdatedEvent
  | import("./ApprovalUpdatedEvent").ApprovalUpdatedEvent;
