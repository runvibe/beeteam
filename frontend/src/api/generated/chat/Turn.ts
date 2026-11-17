// Generated from docs/proposals/integrated-chat-openapi.json. Do not edit.
export type Turn = {
  /** Format: uuid */
  id: string;
  /** Format: uuid */
  chatId: string;
  /** Format: uuid */
  bindingId: string;
  /** @description Absent when no per-turn mode was selected; execution retains legacy provider behavior. */
  accessMode?: import("./AccessMode").AccessMode;
  /** @enum {string} */
  status:
    | "queued"
    | "running"
    | "waiting_approval"
    | "cancel_requested"
    | "completed"
    | "cancelled"
    | "failed"
    | "uncertain";
  failure: {
    code: string;
    message: string;
  } | null;
  version: number;
  /** Format: date-time */
  createdAt: string;
  /** Format: date-time */
  updatedAt: string;
};
