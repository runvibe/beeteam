import { ApiError } from "./types";
import { message } from "@/i18n";
import type { ChatEvent } from "./leader-chat-types";
export interface SseFrame {
  id: string;
  event: string;
  data: string;
}
export class SseDecoder {
  private buffer = "";
  push(chunk: string): SseFrame[] {
    this.buffer += chunk;
    if (this.buffer.length > 2_000_000) throw protocolError();
    const frames: SseFrame[] = [];
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(this.buffer))) {
      const frame = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      let id = "",
        event = "";
      const data: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith(":")) continue;
        const index = line.indexOf(":");
        const field = index < 0 ? line : line.slice(0, index);
        const value = index < 0 ? "" : line.slice(index + 1).replace(/^ /, "");
        if (field === "id") id = value;
        if (field === "event") event = value;
        if (field === "data") data.push(value);
      }
      if (data.length) frames.push({ id, event, data: data.join("\n") });
    }
    return frames;
  }
}
export function protocolError() {
  return new ApiError(0, "incompatible_stream", message("chat.incompatible"));
}
export function decodeChatEvent(frame: SseFrame, chatId: string): ChatEvent {
  let event: ChatEvent;
  try {
    event = JSON.parse(frame.data);
  } catch {
    throw protocolError();
  }
  if (
    !event ||
    event.schemaVersion !== 1 ||
    event.chatId !== chatId ||
    event.id !== frame.id ||
    !event.id ||
    typeof event.createdAt !== "string" ||
    typeof event.turnId !== "string" ||
    event.type !== frame.event ||
    !event.data
  )
    throw protocolError();
  switch (event.type) {
    case "message.updated":
      if (
        !event.data.message ||
        typeof event.data.message.id !== "string" ||
        typeof event.data.message.createdAt !== "string" ||
        event.data.message.turnId !== event.turnId ||
        !["user", "assistant", "system"].includes(event.data.message.role) ||
        event.data.message.chatId !== chatId ||
        typeof event.data.message.content !== "string" ||
        !Number.isInteger(event.data.message.revision) ||
        event.data.message.revision < 1
      )
        throw protocolError();
      break;
    case "turn.updated":
      if (
        !event.data.turn ||
        event.data.turn.id !== event.turnId ||
        typeof event.data.turn.createdAt !== "string" ||
        ![
          "queued",
          "running",
          "waiting_approval",
          "cancel_requested",
          "completed",
          "cancelled",
          "failed",
          "uncertain",
        ].includes(event.data.turn.status) ||
        event.data.turn.chatId !== chatId ||
        !Number.isInteger(event.data.turn.version) ||
        event.data.turn.version < 1
      )
        throw protocolError();
      break;
    case "approval.updated":
      if (
        !event.data.approval ||
        typeof event.data.approval.id !== "string" ||
        event.data.approval.turnId !== event.turnId ||
        typeof event.data.approval.title !== "string" ||
        typeof event.data.approval.description !== "string" ||
        !Array.isArray(event.data.approval.paths) ||
        !event.data.approval.paths.every((path) => typeof path === "string") ||
        !["pending", "accepted", "declined", "expired"].includes(
          event.data.approval.status,
        ) ||
        event.data.approval.chatId !== chatId ||
        !Number.isInteger(event.data.approval.version) ||
        event.data.approval.version < 1
      )
        throw protocolError();
      break;
    case "tool.updated":
      if (
        !event.data.tool?.id ||
        typeof event.data.tool.summary !== "string" ||
        event.data.tool.turnId !== event.turnId ||
        !Number.isInteger(event.data.tool.revision) ||
        event.data.tool.revision < 1 ||
        !["running", "completed", "failed"].includes(event.data.tool.status)
      )
        throw protocolError();
      break;
    default:
      throw protocolError();
  }
  return event;
}
