import { expect, it, vi } from "vitest";
import { createDemoApi } from "./demo";
it("provides four isolated boards and rejects writes without HTTP access", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  const first = createDemoApi(),
    second = createDemoApi();
  const boards = await first.list("boards");
  expect(boards.total).toBe(4);
  expect((await second.list("boards")).items).toEqual(boards.items);
  for (const board of boards.items)
    expect((await first.board(board.id)).columns.length).toBeGreaterThan(0);
  await expect(
    first.patch("boards", boards.items[0].id, { name: "changed" }, 1),
  ).rejects.toMatchObject({ code: "demo_readonly" });
  expect((await first.list("boards")).items[0].name).toBe(boards.items[0].name);
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockRestore();
});
