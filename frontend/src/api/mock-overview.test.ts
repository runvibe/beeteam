import { expect, it } from "vitest";
import { makeSeed, uuid } from "./seed";
import { mockOverview } from "./mock-overview";

it("aggregates every direct child including archived, excludes grandchildren and avoids counting blocked twice", () => {
  const db = makeSeed(),
    parent = db.tasks[0];
  db.tasks = [
    parent,
    ...Array.from({ length: 120 }, (_, i) => ({
      ...parent,
      id: uuid(900 + i),
      parentId: parent.id,
      archivedAt: i === 0 ? parent.updatedAt : null,
      block:
        i < 2
          ? { blocked: true as const, reason: "Registered block" }
          : { blocked: false as const, reason: null },
    })),
    { ...parent, id: uuid(1100), parentId: uuid(900) },
  ];
  const result = mockOverview(db, parent.id);
  expect(result.directSubtasks.total).toBe(120);
  expect(result.directSubtasks.blocked).toBe(2);
  expect(
    result.directSubtasks.byStatus.reduce((n, row) => n + row.total, 0),
  ).toBe(120);
  expect(
    result.directSubtasks.byExecutor.reduce((n, row) => n + row.total, 0),
  ).toBe(120);
});
it("does not infer progress, current summary author or next step from legacy execution records", () => {
  const db = makeSeed(),
    task = db.tasks[0];
  db.timeline = [
    {
      ...db.timeline[0],
      taskId: task.id,
      type: "execution.recorded",
      data: { summary: "historical" },
    },
  ];
  const result = mockOverview(db, task.id);
  expect(result.progressHistory.items).toEqual([]);
  expect(result.currentSummaryMeta).toBeNull();
  expect(result.nextStep).toBeNull();
  expect(result.decisions).toEqual([]);
});
it("uses only the latest explicit synthesis event and supports changes envelopes", () => {
  const db = makeSeed(),
    task = db.tasks[0],
    event = db.timeline[0];
  task.currentSummary = "A";
  db.timeline = [
    { ...event, taskId: task.id, sequence: 1, data: { currentSummary: "A" } },
    {
      ...event,
      id: uuid(1500),
      taskId: task.id,
      sequence: 2,
      data: { changes: { currentSummary: "B" } },
    },
  ];
  expect(mockOverview(db, task.id).currentSummaryMeta).toBeNull();
  task.currentSummary = "B";
  expect(mockOverview(db, task.id).currentSummaryMeta?.eventId).toBe(
    uuid(1500),
  );
});
