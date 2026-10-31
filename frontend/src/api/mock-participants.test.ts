import { expect, it } from "vitest";
import { makeSeed, ids } from "./seed";
import { mockParticipants } from "./mock-participants";

it("includes historical assignments only from live events of the exact task", () => {
  const db = makeSeed();
  const event = db.timeline[0];
  db.timeline.push(
    {
      ...event,
      type: "assignment.changed",
      data: {
        previousExecutorAgentId: "historical",
        executorAgentId: "historical",
      },
    },
    { ...event, taskId: "other-task", data: { authorAgentId: "foreign" } },
    {
      ...event,
      deletedAt: "2026-10-30T00:00:00Z",
      data: { executorAgentId: "deleted-event" },
    },
  );
  const participants = mockParticipants(db, ids.task);
  expect(
    participants.filter((item) => item.actorId === "historical"),
  ).toHaveLength(1);
  expect(
    participants.some((item) =>
      ["foreign", "deleted-event"].includes(item.actorId ?? ""),
    ),
  ).toBe(false);
});
