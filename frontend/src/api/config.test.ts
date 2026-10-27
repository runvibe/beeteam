import { describe, it, expect } from "vitest";
import { createMockApi } from "./mock";
import { ids, uuid } from "./seed";
describe("configuration writes", () => {
  it("adds and reorders statuses without moving tasks and rejects partial order", async () => {
    const api = createMockApi({ delay: 0 });
    const created = await api.createStatus(ids.board, {
      name: "Validação",
      isDone: false,
    });
    const board = await api.get("boards", ids.board);
    const statuses = await api.list("statuses", ids.board, { limit: 100 });
    expect(created.id[14]).toBe("7");
    const order = statuses.items.map((s) => s.id).reverse();
    await api.reorderStatuses(ids.board, order, board.version);
    expect(
      (await api.list("statuses", ids.board, { sortBy: "position" })).items[0]
        .id,
    ).toBe(created.id);
    expect((await api.get("tasks", ids.task)).statusId).toBe(uuid(50));
    await expect(
      api.reorderStatuses(
        ids.board,
        [created.id],
        (await api.get("boards", ids.board)).version,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("keeps status response shape and protects finality of used statuses", async () => {
    const api = createMockApi({ delay: 0 });
    const result = await api.patch("statuses", uuid(50), { name: "Ideias" }, 1);
    expect(result).not.toHaveProperty("updatedAt");
    await expect(
      api.patch("statuses", uuid(50), { isDone: true }, 2),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects oversized UTF8 text without corrupting stored profile", async () => {
    const api = createMockApi({ delay: 0 });
    await expect(
      api.patch("agents", ids.agent, { workStyle: "é".repeat(40000) }, 1),
    ).rejects.toMatchObject({ status: 400 });
    expect((await api.get("agents", ids.agent)).version).toBe(1);
  });
});

it("requires a current summary for progress and preserves it for administrative patches", async () => {
  const api = createMockApi({ delay: 0 });
  const task = await api.get("tasks", ids.task);
  await expect(
    api.patch(
      "tasks",
      ids.task,
      { progress: { percent: 30, note: "working" } },
      task.version,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    api.patch(
      "tasks",
      ids.task,
      { currentSummary: "é".repeat(8193) },
      task.version,
    ),
  ).rejects.toMatchObject({ status: 400 });
  const changed = await api.patch(
    "tasks",
    ids.task,
    {
      progress: { percent: 30, note: "working" },
      currentSummary: "Done A; doing B; pending C",
    },
    task.version,
  );
  const admin = await api.patch(
    "tasks",
    ids.task,
    { autonomyMode: "automatic" },
    changed.version,
  );
  expect(admin.currentSummary).toBe("Done A; doing B; pending C");
});

it("validates specification bytes, rejects null and allows clearing without summary", async () => {
  const api = createMockApi({ delay: 0 });
  const task = await api.get("tasks", ids.task);
  await expect(
    api.patch(
      "tasks",
      ids.task,
      { specification: "é".repeat(32769) },
      task.version,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    api.patch(
      "tasks",
      ids.task,
      { specification: null } as never,
      task.version,
    ),
  ).rejects.toMatchObject({ status: 400 });
  const updated = await api.patch(
    "tasks",
    ids.task,
    { specification: "é".repeat(32768) },
    task.version,
  );
  expect(updated.specification.length).toBe(32768);
  const cleared = await api.patch(
    "tasks",
    ids.task,
    { specification: "" },
    updated.version,
  );
  expect(cleared.specification).toBe("");
  expect(cleared.currentSummary).toBe(task.currentSummary);
});
