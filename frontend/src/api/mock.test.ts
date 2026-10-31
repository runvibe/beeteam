import { describe, expect, it } from "vitest";
import { createMockApi } from "./mock";
import { ids } from "./seed";

describe("mock contract adapter", () => {
  it("paginates after literal title filtering and excludes deleted records", async () => {
    const api = createMockApi({ delay: 0 });
    const page = await api.list("tasks", ids.board, {
      title: "API",
      rootOnly: true,
      offset: 0,
      limit: 1,
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThan(1);
    expect(page.nextOffset).toBe(1);
    const next = await api.list("tasks", ids.board, {
      title: "API",
      rootOnly: true,
      offset: 1,
      limit: 1,
    });
    expect(next.items[0].id).not.toBe(page.items[0].id);
    expect((await api.list("tasks", ids.board, { title: "%" })).total).toBe(0);
  });
  it("keeps empty board columns and paginates active board tasks", async () => {
    const board = await createMockApi({ delay: 0 }).board(ids.board, {
      title: "inexistente",
      limitPerColumn: 1,
    });
    expect(board.columns).toHaveLength(5);
    expect(
      board.columns.every((c) => c.total === 0 && c.tasks.length === 0),
    ).toBe(true);
  });
  it("rejects stale profile updates and preserves omitted fields", async () => {
    const api = createMockApi({ delay: 0 });
    const original = await api.get("agents", ids.agent);
    const saved = await api.patch(
      "agents",
      ids.agent,
      { name: "Novo nome" },
      original.version,
    );
    expect(saved.name).toBe("Novo nome");
    expect(saved.rules).toEqual(original.rules);
    await expect(
      api.patch(
        "agents",
        ids.agent,
        { name: "Sobrescrever" },
        original.version,
      ),
    ).rejects.toMatchObject({ status: 412 });
  });
  it("returns detached snapshots and reports invalid pagination", async () => {
    const api = createMockApi({ delay: 0 });
    const first = await api.get("agents", ids.agent);
    first.name = "Alterado fora da API";
    expect((await api.get("agents", ids.agent)).name).not.toBe(first.name);
    await expect(api.list("agents", "", { limit: 101 })).rejects.toMatchObject({
      status: 400,
    });
  });
});
