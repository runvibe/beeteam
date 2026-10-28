import { describe, expect, it } from "vitest";
import { createMockApi } from "./mock";
import { ids, uuid } from "./seed";
describe("final domain", () => {
  it("discovers children across boards and keeps root context through arbitrary depth", async () => {
    const api = createMockApi({ delay: 0 });
    const children = await api.list("tasks", "", { parentId: uuid(121) });
    expect(children.items[0].boardId).toBe(uuid(11));
    const grandchild = await api.get("tasks", uuid(132));
    expect(grandchild.executionContext.rootTaskId).toBe(ids.task);
    expect(grandchild.executionContext.originBoardId).toBe(ids.board);
    expect(grandchild).not.toHaveProperty("teamId");
  });
  for (const origin of ["manual", "standard", "automatic"] as const)
    for (const individual of ["manual", "automatic"] as const) {
      it(`${origin} origin / ${individual} child ignores destination and parent flags`, async () => {
        const api = createMockApi({ delay: 0 });
        await api.patch("boards", ids.board, { autonomyMode: origin }, 1);
        await api.patch("tasks", uuid(121), { autonomyMode: "automatic" }, 1);
        await api.patch("tasks", uuid(132), { autonomyMode: individual }, 1);
        const task = await api.get("tasks", uuid(132));
        expect(task.autonomyMode).toBe(individual);
        expect(task.executionContext.effectiveMode).toBe(
          origin === "standard" ? individual : origin,
        );
        expect((await api.get("boards", uuid(11))).autonomyMode).toBe("manual");
      });
    }
  it("does not leak internal projection fields in activity links", async () => {
    const page = await createMockApi({ delay: 0 }).list(
      "activities",
      ids.agent,
      { relation: "executing" },
    );
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0]).not.toHaveProperty("archivedAt");
    expect(page.items[0]).not.toHaveProperty("teamId");
  });
});
