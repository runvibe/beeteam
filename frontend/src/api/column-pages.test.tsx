import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiProvider } from "./context";
import { createMockApi } from "./mock";
import type { BeeApi, BoardView, Task } from "./types";
import { makeSeed, uuid } from "./seed";
import { useColumnPages } from "./column-pages";

it("appends, deduplicates and refreshes all loaded pages without dropping earlier tasks", async () => {
  const api = createMockApi({ delay: 0 });
  const sample = (await api.list("tasks", "")).items[0];
  const records = Array.from(
    { length: 13 },
    (_, i) => ({ ...sample, id: `task-${i}`, title: `Task ${i}` }) as Task,
  );
  let failNext = true;
  const list = vi.fn(
    async (
      _r: string,
      _s: string,
      f: { offset?: number; limit?: number } = {},
    ) => {
      const offset = f.offset ?? 0,
        limit = f.limit ?? 6;
      if (offset === 6 && failNext) {
        failNext = false;
        throw new Error("offline");
      }
      return {
        items: records.slice(offset, offset + limit),
        offset,
        limit,
        total: 13,
        hasMore: offset + limit < 13,
        nextOffset: offset + limit < 13 ? offset + limit : null,
      };
    },
  );
  api.list = list as BeeApi["list"];
  const column = {
    status: { id: "status" },
    tasks: records.slice(0, 6),
    limit: 6,
    total: 13,
    hasMore: true,
    nextOffset: 6,
  } as BoardView["columns"][number];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );
  const { result } = renderHook(
    () => ({
      ...useColumnPages("board", column, { limitPerColumn: 6 }),
      client: useQueryClient(),
    }),
    { wrapper },
  );
  expect(result.current.items).toHaveLength(6);
  expect(list).not.toHaveBeenCalled();
  act(() => result.current.loadMore());
  expect(result.current.items).toHaveLength(6);
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.items).toHaveLength(6);
  await act(async () => {
    await result.current.retry();
  });
  await waitFor(() => expect(result.current.items).toHaveLength(12));
  records[12] = records[11];
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.hasMore).toBe(false));
  expect(result.current.items).toHaveLength(12);
  records[0] = { ...records[0], title: "Changed remotely" };
  await act(async () => {
    await result.current.client.invalidateQueries();
  });
  await waitFor(() =>
    expect(result.current.items[0].title).toBe("Changed remotely"),
  );
  expect(result.current.items).toHaveLength(12);
  expect(list.mock.calls.map((c) => c[2]?.offset)).toEqual([
    6, 6, 12, 0, 6, 12,
  ]);
});

it("aborts obsolete continuation and ignores its late result after a filter change", async () => {
  const api = createMockApi({ delay: 0 });
  let signal: AbortSignal | undefined;
  let finish!: (value: unknown) => void;
  api.list = vi.fn((_r, _s, _f, abort) => {
    signal = abort;
    return new Promise((resolve) => {
      finish = resolve;
    });
  }) as BeeApi["list"];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );
  const initial = {
    status: { id: "status" },
    tasks: [{ id: "old" }],
    offset: 0,
    limit: 6,
    total: 8,
    hasMore: true,
    nextOffset: 6,
  } as BoardView["columns"][number];
  const { result, rerender } = renderHook(
    ({ blocked }) =>
      useColumnPages(
        "board",
        blocked
          ? {
              ...initial,
              tasks: [{ id: "new" } as Task],
              total: 1,
              hasMore: false,
              nextOffset: null,
            }
          : initial,
        { limitPerColumn: 6, blocked },
      ),
    { wrapper, initialProps: { blocked: false } },
  );
  act(() => result.current.loadMore());
  await waitFor(() => expect(signal).toBeDefined());
  rerender({ blocked: true });
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    finish({
      items: [{ id: "obsolete" }],
      offset: 6,
      limit: 6,
      total: 8,
      hasMore: false,
      nextOffset: null,
    });
  });
  expect(result.current.items.map((t) => t.id)).toEqual(["new"]);
  expect(result.current.hasMore).toBe(false);
});

it("includes direct and nested children in board pages without importing foreign-board children", async () => {
  const seed = makeSeed();
  const parent = seed.tasks[0];
  seed.tasks = [
    parent,
    ...Array.from({ length: 8 }, (_, i) => ({
      ...parent,
      id: uuid(900 + i),
      slug: `child-${i}`,
      title: `Child ${i}`,
      position: `z${i}`,
      parentId: i === 7 ? uuid(900) : parent.id,
    })),
    {
      ...parent,
      id: uuid(950),
      slug: "foreign-child",
      boardId: uuid(951),
      parentId: parent.id,
    },
  ];
  const api = createMockApi({ delay: 0, seed });
  const board = await api.board(parent.boardId, { limitPerColumn: 6 });
  const column = board.columns.find((c) => c.status.id === parent.statusId)!;
  expect(column.total).toBe(9);
  expect(column.tasks).toHaveLength(6);
  const list = vi.spyOn(api, "list");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );
  const { result } = renderHook(
    () => useColumnPages(parent.boardId, column, { limitPerColumn: 6 }),
    { wrapper },
  );
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.items).toHaveLength(9));
  expect(list.mock.calls[0][1]).toBe(parent.boardId);
  expect(list.mock.calls[0][2]?.rootOnly).toBeUndefined();
  expect(result.current.items.some((t) => t.id === uuid(950))).toBe(false);
  expect(result.current.items.find((t) => t.id === uuid(907))?.parentId).toBe(
    uuid(900),
  );
});
