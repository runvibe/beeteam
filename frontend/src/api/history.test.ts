import { it, expect } from "vitest";
import { createMockApi } from "./mock";
import { makeSeed, ids, uuid } from "./seed";
it("orders revisions ascending by default and applies actor/date filters before pagination", async () => {
  const api = createMockApi({ delay: 0 });
  const revisions = await api.revisions(ids.task, uuid(310), { limit: 1 });
  expect(revisions.items[0].revision).toBe(1);
  expect(
    (await api.revisions(ids.task, uuid(310), { actorId: uuid(99) })).total,
  ).toBe(0);
  expect(
    (
      await api.revisions(ids.task, uuid(310), {
        createdBefore: "2026-01-01T00:00:00Z",
      })
    ).total,
  ).toBe(0);
});
it("uses newest nondeleted own summary, not fixture insertion order", async () => {
  const seed = makeSeed();
  seed.summaries.push(
    { ...seed.summaries[0], id: uuid(401), createdAt: "2026-10-28T00:00:00Z" },
    {
      ...seed.summaries[0],
      id: uuid(402),
      createdAt: "2026-10-29T00:00:00Z",
      deletedAt: "2026-10-29T01:00:00Z",
    },
  );
  const api = createMockApi({ delay: 0, seed });
  const activity = (
    await api.list("activities", ids.agent, { relation: "worked" })
  ).items[0];
  expect(activity.latestOwnSummaryId).toBe(uuid(401));
});
it("provides uploaded image bytes through the adapter", async () => {
  const seed = makeSeed();
  seed.agents[0].image = {
    kind: "upload",
    imageId: uuid(999),
    mediaType: "image/png",
    sizeBytes: 68,
    contentPath: `/api/v1/agents/${ids.agent}/image/content`,
    deletedAt: null,
  };
  const image = await createMockApi({ delay: 0, seed }).image(ids.agent);
  expect(image.type).toBe("image/png");
  expect(image.size).toBeGreaterThan(0);
});
