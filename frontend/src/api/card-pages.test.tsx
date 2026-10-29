import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiProvider } from "./context";
import { createMockApi } from "./mock";
import { useCardPages } from "./card-pages";
import { usePageSize, useUrlState } from "@/routing/query";
import type { BeeApi, Board, Page } from "./types";

async function fixture() {
  const api = createMockApi({ delay: 0 });
  const sample = (await api.list("boards")).items[0];
  const records = Array.from({ length: 30 }, (_, index) => ({
    ...sample,
    id: `board-${index}`,
    name: `Board ${index}`,
  }));
  const list = vi.fn(
    async (
      _resource: string,
      _scope: string,
      filters: { offset?: number; limit?: number } = {},
    ) => {
      const offset = filters.offset ?? 0,
        limit = filters.limit ?? 12;
      return {
        items: records.slice(offset, offset + limit),
        offset,
        limit,
        total: records.length,
        hasMore: offset + limit < records.length,
        nextOffset: offset + limit < records.length ? offset + limit : null,
      };
    },
  );
  api.list = list as BeeApi["list"];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider api={api}>{children}</ApiProvider>
  );
  return { api, list, records, wrapper };
}
function useHarness() {
  const [name, setName] = useUrlState<string>("boards.name", "");
  const [offset] = useUrlState("boards.offset", 0);
  const limit = usePageSize("boards", 12);
  return {
    ...useCardPages("boards", {
      name: name || undefined,
      offset,
      limit,
      sortBy: "name",
    }),
    setName,
    client: useQueryClient(),
  };
}
it("uses measured next-block sizes and exact offsets, retaining earlier cards while fetching", async () => {
  window.history.replaceState({}, "", "/boards?boards.window=0:2");
  const { wrapper, list } = await fixture();
  const { result } = renderHook(useHarness, { wrapper });
  await waitFor(() => expect(result.current.items).toHaveLength(2));
  act(() => result.current.setCapacity(3));
  act(() => result.current.loadMore());
  expect(result.current.items).toHaveLength(2);
  await waitFor(() => expect(result.current.items).toHaveLength(5));
  expect(list.mock.calls.map((call) => call[2])).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ offset: 0, limit: 2 }),
      expect.objectContaining({ offset: 2, limit: 3 }),
    ]),
  );
  act(() => result.current.setCapacity(1));
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.items).toHaveLength(6));
  expect(location.search).toContain("boards.window=0%3A2%2C2%3A3%2C5%3A1");
});
it("restores only the encoded bounded window, deduplicates overlapping IDs and refreshes in place", async () => {
  window.history.replaceState(
    {},
    "",
    "/boards?boards.offset=8&boards.window=8:2,10:2",
  );
  const { wrapper, list, records } = await fixture();
  records[10] = { ...records[9], name: "Updated duplicate" };
  const { result } = renderHook(useHarness, { wrapper });
  await waitFor(() => expect(result.current.items).toHaveLength(3));
  expect(list.mock.calls.map((call) => call[2]?.offset).sort()).toEqual([
    10, 8,
  ]);
  expect(result.current.items.find((item) => item.id === "board-9")?.name).toBe(
    "Updated duplicate",
  );
  records[10] = { ...records[10], name: "Reconnect update" };
  await act(async () => {
    await result.current.client.cancelQueries();
    await result.current.client.invalidateQueries();
  });
  expect(result.current.items).toHaveLength(3);
  await waitFor(() =>
    expect(
      result.current.items.find((item) => item.id === "board-9")?.name,
    ).toBe("Reconnect update"),
  );
});
it("aborts an abandoned filter request and ignores its late response", async () => {
  window.history.replaceState(
    {},
    "",
    "/boards?boards.name=slow&boards.window=0:2",
  );
  const { api, wrapper, records } = await fixture();
  let oldSignal: AbortSignal | undefined;
  let finishOld: (page: Page<Board>) => void = () => {};
  api.list = vi.fn((_resource, _scope, filters, signal) => {
    if (filters?.name === "slow") {
      oldSignal = signal;
      return new Promise((resolve) => {
        finishOld = resolve as typeof finishOld;
      });
    }
    return Promise.resolve({
      items: [records[4]],
      offset: 0,
      limit: 1,
      total: 1,
      hasMore: false,
      nextOffset: null,
    });
  }) as BeeApi["list"];
  const { result } = renderHook(useHarness, { wrapper });
  await waitFor(() => expect(oldSignal).toBeDefined());
  act(() => result.current.setName("fast"));
  await waitFor(() => expect(result.current.items[0]?.id).toBe("board-4"));
  expect(oldSignal?.aborted).toBe(true);
  expect(location.search).not.toContain("boards.window");
  await act(async () =>
    finishOld({
      items: [records[0]],
      offset: 0,
      limit: 1,
      total: 1,
      hasMore: false,
      nextOffset: null,
    }),
  );
  expect(result.current.items[0].id).toBe("board-4");
});
it("caps retained blocks at five and stops at the real end", async () => {
  window.history.replaceState({}, "", "/boards?boards.limit=1");
  const { wrapper, records } = await fixture();
  records.splice(7);
  const { result } = renderHook(useHarness, { wrapper });
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  for (let index = 1; index < 7; index++) {
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.fetching).toBe(false));
    await waitFor(() =>
      expect(result.current.items.at(-1)?.id).toBe(`board-${index}`),
    );
  }
  expect(result.current.items).toHaveLength(5);
  expect(result.current.start).toBe(2);
  expect(result.current.hasMore).toBe(false);
  const url = location.search;
  act(() => result.current.loadMore());
  expect(location.search).toBe(url);
});
