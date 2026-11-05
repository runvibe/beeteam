import { legacyFetch } from "@/api/legacy-fetch.fixture";
import { expect, it, vi } from "vitest";
import { createHttpApi } from "./http";
it("reads explicit task interval resources and authoritative aggregate without summing pages", async () => {
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          items: [],
          total: 0,
          hasMore: false,
          nextOffset: null,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  );
  const api = createHttpApi({ fetch: legacyFetch(fetcher) });
  await api.executionIntervalUsage("task/id");
  await api.executionIntervals("task/id", { offset: 20, limit: 20 });
  await api.executionTrackingEvents("task/id", { offset: 40, limit: 20 });
  await api.executionIntervalRevisions("task/id", "interval/id", {
    offset: 0,
    limit: 20,
  });
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/v1/tasks/task%2Fid/execution-interval-usage",
    "/api/v1/tasks/task%2Fid/execution-intervals?offset=20&limit=20",
    "/api/v1/tasks/task%2Fid/execution-tracking-events?offset=40&limit=20",
    "/api/v1/tasks/task%2Fid/execution-intervals/interval%2Fid/revisions?offset=0&limit=20",
  ]);
});
