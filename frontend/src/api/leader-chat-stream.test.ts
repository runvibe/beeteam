import { describe, expect, it } from "vitest";
import { SseDecoder, decodeChatEvent } from "./leader-chat-stream";

describe("leader chat stream", () => {
  it("retains split CRLF frames and multiline data while ignoring heartbeats", () => {
    const parser = new SseDecoder();
    expect(parser.push(": heartbeat\r\n\r\nid: abc\r")).toEqual([]);
    expect(
      parser.push(
        '\nevent: message.updated\r\ndata: {"x":\r\ndata: 1}\r\n\r\n',
      ),
    ).toEqual([{ id: "abc", event: "message.updated", data: '{"x":\n1}' }]);
  });
  it("rejects mismatched envelope identifiers and unsupported protocol events", () => {
    expect(() =>
      decodeChatEvent({ id: "1", event: "unknown", data: "{}" }, "chat"),
    ).toThrow();
    expect(() =>
      decodeChatEvent(
        {
          id: "1",
          event: "turn.updated",
          data: JSON.stringify({
            schemaVersion: 1,
            id: "2",
            chatId: "chat",
            type: "turn.updated",
          }),
        },
        "chat",
      ),
    ).toThrow();
  });
  it("rejects malformed tool revisions before applying the payload", () => {
    const data = {
      schemaVersion: 1,
      id: "1",
      chatId: "chat",
      turnId: "t",
      createdAt: "2026-11-08T00:00:00Z",
      type: "tool.updated",
      data: {
        tool: {
          id: "tool",
          turnId: "t",
          name: "search",
          summary: "done",
          status: "completed",
        },
      },
    };
    expect(() =>
      decodeChatEvent(
        { id: "1", event: "tool.updated", data: JSON.stringify(data) },
        "chat",
      ),
    ).toThrow();
  });
});
