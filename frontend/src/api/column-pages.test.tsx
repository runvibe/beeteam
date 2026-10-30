import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiProvider } from "./context";
import { createMockApi } from "./mock";
import type { BeeApi, BoardView, Task } from "./types";
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
