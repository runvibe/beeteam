import { legacyFetch } from "@/api/legacy-fetch.fixture";
import { expect, it, vi } from "vitest";
import { createMockApi } from "./mock";
import { createHttpApi } from "./http";
import { makeSeed, ids, uuid } from "./seed";
it("reads explicit latest activity without querying related tasks", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ activity: null }), { status: 200 }),
    );
  expect(
    await createHttpApi({ fetch: legacyFetch(fetcher) }).agentLatestActivity(
      ids.agent,
    ),
  ).toEqual({ activity: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(
    `/api/v1/agents/${ids.agent}/latest-activity`,
  );
});
it("uses event attribution/time, includes archived tasks and ignores human or deleted events", async () => {
  const seed = makeSeed();
  const event = seed.timeline[1];
  seed.tasks[0].archivedAt = "2026-10-28T00:00:00Z";
  seed.tasks[0].updatedAt = "2099-01-01T00:00:00Z";
  seed.timeline = [
    {
      ...event,
      id: uuid(950),
      type: "comment.created",
      occurredAt: "2026-10-29T00:00:00Z",
      data: {},
    },
    {
      ...event,
      id: uuid(951),
      actorKind: "human",
      occurredAt: "2026-10-30T00:00:00Z",
    },
    {
      ...event,
      id: uuid(952),
      deletedAt: "2026-10-30T00:00:00Z",
      occurredAt: "2026-10-30T00:00:00Z",
    },
  ];
  expect(
    (await createMockApi({ delay: 0, seed }).agentLatestActivity(ids.agent))
      .activity,
  ).toMatchObject({
    eventId: uuid(950),
    occurredAt: "2026-10-29T00:00:00Z",
    summaryId: null,
    type: "comment.created",
    taskId: ids.task,
  });
});
it("does not infer activity from profile/task updates and handles missing agent separately", async () => {
  const seed = makeSeed();
  seed.timeline = [];
  const api = createMockApi({ delay: 0, seed });
  expect(await api.agentLatestActivity(ids.agent)).toEqual({
    activity: null,
  });
  await expect(api.agentLatestActivity(uuid(999))).rejects.toMatchObject({
    status: 404,
  });
});

it("excludes deleted task/board, orders ties and validates explicit summary references", async () => {
  const seed = makeSeed(),
    event = seed.timeline[1];
  seed.timeline = [
    { ...event, id: uuid(960), sequence: 8 },
    {
      ...event,
      id: uuid(961),
      sequence: 8,
      data: { executionSummaryId: "missing" },
    },
  ];
  let result = await createMockApi({ delay: 0, seed }).agentLatestActivity(
    ids.agent,
  );
  expect(result.activity).toMatchObject({
    eventId: uuid(961),
    summaryId: null,
  });
  seed.timeline.pop();
  result = await createMockApi({ delay: 0, seed }).agentLatestActivity(
    ids.agent,
  );
  expect(result.activity?.summaryId).toBe(event.data.executionSummaryId);
  seed.boards.find((b) => b.id === seed.tasks[0].boardId)!.deletedAt =
    "2026-10-30T00:00:00Z";
  expect(
    await createMockApi({ delay: 0, seed }).agentLatestActivity(ids.agent),
  ).toEqual({ activity: null });
});
