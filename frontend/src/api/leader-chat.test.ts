import { expect, it, vi } from "vitest";
import { createLeaderChatApi } from "./leader-chat";
it("uses v2 on the configured host and preserves message retry identifiers", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response("{}", {
      status: 202,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const api = createLeaderChatApi({
    baseUrl: "http://127.0.0.1:59867/api/v1",
    fetch: fetcher,
  });
  await api.send(
    "chat",
    { clientMessageId: "message", bindingId: "binding", content: "hello" },
    "retry-key",
  );
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("http://127.0.0.1:59867/api/v2/leader-chats/chat/messages");
  expect(new Headers(init.headers).get("Idempotency-Key")).toBe("retry-key");
  expect(new Headers(init.headers).get("X-Actor-Kind")).toBe("human");
  expect(JSON.parse(init.body).clientMessageId).toBe("message");
});
it("reads cursor-expired errors before entering the stream", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ code: "cursor_expired", error: "expired" }),
        { status: 409 },
      ),
    );
  const api = createLeaderChatApi({ fetch: fetcher });
  await expect(
    api.stream("chat", "cursor", new AbortController().signal, vi.fn()),
  ).rejects.toMatchObject({ code: "cursor_expired", status: 409 });
  expect(
    new Headers(fetcher.mock.calls[0][1].headers).get("Last-Event-ID"),
  ).toBe("cursor");
});
it("streams fragmented UTF-8 events once and verifies the connection before notifying", async () => {
  const event = {
    schemaVersion: 1,
    id: "next",
    chatId: "chat",
    turnId: "turn",
    createdAt: "2026-11-08T00:00:00Z",
    type: "message.updated",
    data: {
      message: {
        id: "m",
        chatId: "chat",
        turnId: "turn",
        role: "assistant",
        content: "Olá 🐝",
        revision: 1,
        taskId: null,
        clientMessageId: null,
        createdAt: "2026-11-08T00:00:00Z",
      },
    },
  };
  const bytes = new TextEncoder().encode(
    "id: next\nevent: message.updated\ndata: " + JSON.stringify(event) + "\n\n",
  );
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 3)
        controller.enqueue(bytes.slice(i, i + 3));
      controller.close();
    },
  });
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(stream, {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
  const opened = vi.fn(),
    received = vi.fn();
  await createLeaderChatApi({ fetch: fetcher }).stream(
    "chat",
    "cursor",
    new AbortController().signal,
    received,
    opened,
  );
  expect(opened).toHaveBeenCalledTimes(1);
  expect(received).toHaveBeenCalledExactlyOnceWith(event);
});
