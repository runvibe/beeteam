import { it, expect, vi } from "vitest";
import { createManagedAgentApi } from "./managed-agents";
it("sends agent requests without provider identifiers", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "request" }), { status: 202 }),
    );
  const api = createManagedAgentApi({
    baseUrl: "http://127.0.0.1:59867/api/v1",
    fetch,
  });
  await api.send("agent", { content: "Hello" }, "key");
  expect(fetch.mock.calls[0][0]).toBe(
    "http://127.0.0.1:59867/api/v2/agents/agent/requests",
  );
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ content: "Hello" });
});
