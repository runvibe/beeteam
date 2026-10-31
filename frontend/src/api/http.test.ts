import { it, expect, vi } from "vitest";
import { createHttpApi } from "./http";
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
it("requests one authoritative task overview snapshot", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ task: { id: "task" } }));
  await createHttpApi({ fetch: fetcher }).overview("task");
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/tasks/task/overview");
});
it("requests task participants with pagination only", async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ items: [] }));
  await createHttpApi({ fetch: fetcher }).participants("task", {
    offset: 100,
    limit: 100,
  });
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/v1/tasks/task/participants?offset=100&limit=100",
  );
});
it("propagates list cancellation to fetch without reporting a timeout", async () => {
  let transportSignal: AbortSignal | undefined;
  const fetcher = vi.fn(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        transportSignal = init.signal;
        init.signal.addEventListener("abort", () =>
          reject(new DOMException("cancelled", "AbortError")),
        );
      }),
  );
  const api = createHttpApi({ fetch: fetcher });
  const controller = new AbortController();
  const request = api.list("boards", "", {}, controller.signal);
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(transportSignal?.aborted).toBe(true);
});
it("maps scoped/global resources and preserves exact query semantics", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async () => response({ items: [] }));
  const api = createHttpApi({ fetch: fetcher });
  await api.list("tasks", "", {
    parentId: "parent",
    offset: 20,
    limit: 10,
    blocked: false,
    title: "a&b",
  });
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/v1/tasks?parentId=parent&offset=20&limit=10&blocked=false&title=a%26b",
  );
  await api.list("tasks", "board", { statusId: "s", rootOnly: true });
  expect(fetcher.mock.calls[1][0]).toContain("/boards/board/tasks?");
  await api.list("summaries", "task");
  expect(fetcher.mock.calls[2][0]).toBe(
    "/api/v1/tasks/task/execution-summaries",
  );
  await api.list("chats", "agent");
  expect(fetcher.mock.calls[3][0]).toBe("/api/v1/agents/agent/chat-references");
});
it("writes human attribution, strong versions, status board scope and stable creation keys", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(async () => response({ version: 2 }));
  const api = createHttpApi({ fetch: fetcher });
  await api.patch("statuses", "status", { name: "Revisão" }, 3, "board");
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("/api/v1/boards/board/statuses/status");
  expect(init.method).toBe("PATCH");
  expect(new Headers(init.headers).get("If-Match")).toBe('"3"');
  expect(new Headers(init.headers).get("X-Actor-Kind")).toBe("human");
  await api.createStatus(
    "board",
    { name: "Novo", isDone: false },
    "intent-key",
  );
  await api.createStatus(
    "board",
    { name: "Novo", isDone: false },
    "intent-key",
  );
  expect(
    new Headers(fetcher.mock.calls[1][1].headers).get("Idempotency-Key"),
  ).toBe("intent-key");
  expect(
    new Headers(fetcher.mock.calls[2][1].headers).get("Idempotency-Key"),
  ).toBe("intent-key");
  await api.reorderStatuses("board", ["a", "b"], 4);
  expect(fetcher.mock.calls[3][1].body).toBe('{"statusIds":["a","b"]}');
});
it("preserves backend errors and reports non-json/network failures without mock fallback", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        { error: "Versão alterada", code: "version_conflict", details: {} },
        412,
      ),
    )
    .mockResolvedValueOnce(new Response("<html>bad</html>", { status: 503 }))
    .mockRejectedValueOnce(new TypeError("offline"));
  const api = createHttpApi({ fetch: fetcher });
  await expect(api.get("agents", "a")).rejects.toMatchObject({
    status: 412,
    code: "version_conflict",
    message: "Versão alterada",
  });
  await expect(api.get("agents", "a")).rejects.toMatchObject({ status: 503 });
  await expect(api.get("agents", "a")).rejects.toMatchObject({
    status: 0,
    code: "network_error",
  });
});
it("reads resolvers and binary content through the transport", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ id: "id", slug: "lia" }))
    .mockResolvedValueOnce(
      new Response("bytes", { headers: { "Content-Type": "image/png" } }),
    );
  const api = createHttpApi({ fetch: fetcher });
  expect(await api.resolveSlug("agents", "lia")).toEqual({
    id: "id",
    slug: "lia",
  });
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/agents/by-slug/lia");
  expect((await api.image("id")).type).toBe("image/png");
});
