import { expect, it, vi } from "vitest";
import { createHttpApi } from "./http";
it("sends independent exact Event and Summary identifiers to their scoped endpoints", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            items: [],
            total: 0,
            offset: 0,
            limit: 1,
            hasMore: false,
            nextOffset: null,
          }),
        ),
    );
  const api = createHttpApi({ fetch: fetcher });
  await api.list("timeline", "task", {
    id: "event-id",
    includeChildren: true,
    limit: 1,
  });
  await api.executionTrackingEvents("task", {
    summaryId: "summary-id",
    limit: 1,
  });
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/v1/tasks/task/timeline?id=event-id&includeChildren=true&limit=1",
  );
  expect(fetcher.mock.calls[1][0]).toBe(
    "/api/v1/tasks/task/execution-tracking-events?summaryId=summary-id&limit=1",
  );
});
