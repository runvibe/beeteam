// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type Snapshot = {
  chat: import("./Chat").Chat;
  messages: import("./Message").Message[];
  olderMessagesCursor: string | null;
  activeTurn: import("./Turn").Turn | null;
  pendingApprovals: import("./Approval").Approval[];
  toolActivities: import("./ToolActivity").ToolActivity[];
  eventCursor: string;
};
