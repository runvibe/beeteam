import { it, expect, vi } from "vitest";
import { legacyFetch } from "./legacy-fetch.fixture";
import { createHttpApi } from "./http";
it("posts explicit stable mention IDs and retains the caller's retry key", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "comment" }), { status: 201 }),
    );
  const api = createHttpApi({ fetch: legacyFetch(fetcher) });
  await api.createComment(
    "task",
    { body: "[Worker](/agents/worker)", mentionedAgentIds: ["stable-agent"] },
    7,
    "same-retry-key",
  );
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/tasks/task/comments");
  const init = fetcher.mock.calls[0][1];
  expect(init.headers.get("Idempotency-Key")).toBe("same-retry-key");
  expect(init.headers.get("If-Match")).toBe('"7"');
  expect(JSON.parse(init.body).mentionedAgentIds).toEqual(["stable-agent"]);
});
