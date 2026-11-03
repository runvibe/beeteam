import { useQueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";
import { TaskRecordList } from "./task-record-list";

afterEach(() => vi.unstubAllGlobals());
it.each(["tasks", "attachments", "timeline", "summaries"] as const)(
  "autofills bounded %s pages, deduplicates and stops",
  async (resource) => {
    const seed = makeSeed();
    const api = createMockApi({ delay: 0, seed });
    const records = Array.from({ length: 5 }, (_, i) => ({
      ...seed[resource][0],
      id: uuid(900 + i),
    }));
    const list = vi
      .spyOn(api, "list")
      .mockImplementation(async (_resource, _scope, filters) => {
        const offset = filters?.offset ?? 0;
        return {
          items: records.slice(offset ? offset - 1 : 0, offset + 2),
          offset,
          limit: 2,
          total: 5,
          hasMore: offset < 4,
          nextOffset: offset < 4 ? offset + 2 : null,
        } as never;
      });
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        top: 0,
        bottom: 60,
        height: 60,
        left: 0,
        right: 400,
        width: 400,
      } as DOMRect);
    try {
      render(
        <ApiProvider api={api}>
          <TaskRecordList
            resource={resource}
            scope="task"
            filters={{ limit: 2, offset: 10 }}
            empty="Empty"
          >
            {(row) => <p>{row.id}</p>}
          </TaskRecordList>
        </ApiProvider>,
      );
      await screen.findByText(records[4].id);
      expect(list.mock.calls.map((call) => call[2]?.offset)).toEqual([0, 2, 4]);
      expect(screen.getAllByText(records[1].id)).toHaveLength(1);
      expect(
        screen.queryByRole("navigation", { name: "Paginação" }),
      ).toBeNull();
    } finally {
      bounds.mockRestore();
    }
  },
);

it.each(["task", "filter"])(
  "aborts and isolates stale %s responses",
  async (change) => {
    const api = createMockApi({ delay: 0 });
    const item = makeSeed().timeline[0];
    let signal: AbortSignal | undefined;
    let finish!: (value: unknown) => void;
    vi.spyOn(api, "list").mockImplementation(
      async (_resource, scope, _filters, abort) => {
        if (scope === "old" && !_filters?.includeChildren) {
          signal = abort;
          return (await new Promise((resolve) => {
            finish = resolve;
          })) as never;
        }
        return {
          items: [{ ...item, id: "new" }],
          offset: 0,
          limit: 2,
          total: 1,
          hasMore: false,
          nextOffset: null,
        } as never;
      },
    );
    const draw = (scope: string, includeChildren: boolean) => (
      <ApiProvider api={api}>
        <TaskRecordList
          resource="timeline"
          scope={scope}
          filters={{ includeChildren, limit: 2 }}
          empty="Empty"
        >
          {(row) => <p>{row.id}</p>}
        </TaskRecordList>
      </ApiProvider>
    );
    const view = render(draw("old", false));
    await waitFor(() => expect(signal).toBeDefined());
    view.rerender(draw(change === "task" ? "new" : "old", true));
    await screen.findByText("new");
    expect(signal?.aborted).toBe(true);
    await act(async () =>
      finish({
        items: [item],
        offset: 0,
        limit: 2,
        total: 1,
        hasMore: false,
        nextOffset: null,
      }),
    );
    expect(screen.queryByText(item.id)).toBeNull();
  },
);

it.each(["children", "attachments", "timeline", "summaries"])(
  "uses an infinite list in the %s task tab without pagination controls",
  async (tab) => {
    const seed = makeSeed();
    window.history.replaceState(
      {},
      "",
      `/tasks/${seed.tasks[0].id}?tab=${tab}`,
    );
    render(
      <ApiProvider api={createMockApi({ delay: 0, seed })}>
        <App />
      </ApiProvider>,
    );
    await waitFor(() =>
      expect(
        document.querySelector("[data-task-record-sentinel]"),
      ).not.toBeNull(),
    );
    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
  },
);

it("retains loaded rows after a next-page failure and retries only that page", async () => {
  let intersect = () => {};
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = () =>
          callback(
            [{ isIntersecting: true }] as IntersectionObserverEntry[],
            {} as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
  const api = createMockApi({ delay: 0 });
  const item = makeSeed().attachments[0];
  let attempts = 0;
  const list = vi
    .spyOn(api, "list")
    .mockImplementation(async (_r, _s, filters) => {
      const offset = filters?.offset ?? 0;
      if (offset && ++attempts === 1) throw new Error("Temporary failure");
      return {
        items: [{ ...item, id: offset ? "second" : "first" }],
        offset,
        limit: 1,
        total: 2,
        hasMore: !offset,
        nextOffset: offset ? null : 1,
      } as never;
    });
  render(
    <ApiProvider api={api}>
      <TaskRecordList
        resource="attachments"
        scope="task"
        filters={{ limit: 1 }}
        empty="Empty"
      >
        {(row) => <p>{row.id}</p>}
      </TaskRecordList>
    </ApiProvider>,
  );
  await screen.findByText("first");
  act(() => {
    intersect();
    intersect();
  });
  await screen.findByRole("alert");
  expect(screen.getByText("first")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: /Tentar novamente/i }),
  );
  await screen.findByText("second");
  expect(list.mock.calls.map((call) => call[2]?.offset)).toEqual([0, 1, 1]);
});

it("resumes visible autofill after live refresh cancels an in-flight next page", async () => {
  const api = createMockApi({ delay: 0 });
  const item = makeSeed().attachments[0];
  let nextAttempts = 0;
  vi.spyOn(api, "list").mockImplementation(async (_r, _s, filters) => {
    const offset = filters?.offset ?? 0;
    if (offset && ++nextAttempts === 1)
      return (await new Promise(() => {})) as never;
    return {
      items: [{ ...item, id: offset ? "second" : "first" }],
      offset,
      limit: 1,
      total: 2,
      hasMore: !offset,
      nextOffset: offset ? null : 1,
    } as never;
  });
  const bounds = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      top: 0,
      bottom: 60,
      height: 60,
      left: 0,
      right: 400,
      width: 400,
    } as DOMRect);
  function Refresh() {
    const client = useQueryClient();
    return (
      <button
        onClick={async () => {
          await client.cancelQueries();
          await client.invalidateQueries();
        }}
      >
        Refresh
      </button>
    );
  }
  try {
    render(
      <ApiProvider api={api}>
        <Refresh />
        <TaskRecordList
          resource="attachments"
          scope="task"
          filters={{ limit: 1 }}
          empty="Empty"
        >
          {(row) => <p>{row.id}</p>}
        </TaskRecordList>
      </ApiProvider>,
    );
    await waitFor(() => expect(nextAttempts).toBe(1));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByText("second");
  } finally {
    bounds.mockRestore();
  }
});

it("queries selected summary directly without traversing or scrolling", async () => {
  window.history.replaceState(
    {},
    "",
    "/tasks/example?summaries.selected=older",
  );
  const api = createMockApi({ delay: 0 });
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  const list = vi.spyOn(api, "list").mockImplementation(
    async (_r, _s, f) =>
      ({
        items: [{ ...makeSeed().summaries[0], id: f?.id || "newer" }],
        offset: 0,
        limit: 1,
        total: 1,
        hasMore: false,
        nextOffset: null,
      }) as never,
  );
  render(
    <ApiProvider api={api}>
      <TaskRecordList
        resource="summaries"
        scope="task"
        filters={{ limit: 1 }}
        empty="Empty"
      >
        {(row) => <p>{row.id}</p>}
      </TaskRecordList>
    </ApiProvider>,
  );
  await screen.findByText("older");
  expect(list).toHaveBeenCalledTimes(1);
  expect(list.mock.calls[0][2]).toMatchObject({ id: "older", offset: 0 });
  expect(scroll).not.toHaveBeenCalled();
  window.history.replaceState({}, "", "/");
});
