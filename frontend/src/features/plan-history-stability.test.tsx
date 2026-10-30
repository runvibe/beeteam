import { act, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { PlanHistory } from "./plan-history";

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])(
  "keeps the loading slot and existing records stable across a deferred final page (empty=%s)",
  async (empty) => {
    const style = document.createElement("style");
    style.textContent = readFileSync("src/features/task-detail.css", "utf8");
    document.head.append(style);
    let enter: IntersectionObserverCallback = () => {};
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          enter = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const seed = makeSeed(),
      item = seed.plans[0];
    const api = createMockApi({ seed, delay: 0 });
    const page = (offset: number) => ({
      items:
        offset && empty
          ? []
          : [{ ...item, id: uuid(8000 + offset), revision: offset + 1 }],
      offset,
      limit: 1,
      total: 2,
      hasMore: !offset,
      nextOffset: offset ? null : 1,
    });
    let finish!: (value: ReturnType<typeof page>) => void;
    const request = vi
      .spyOn(api, "revisions")
      .mockImplementation(async (_task, _plan, filters) =>
        filters?.offset
          ? new Promise((resolve) => {
              finish = resolve;
            })
          : page(0),
      );
    try {
      const view = render(
        <ApiProvider api={api}>
          <PlanHistory item={item} onSelect={() => {}} />
        </ApiProvider>,
      );
      const first = await screen.findByRole("button", {
        name: "Ver revisão 1",
      });
      const slot = view.container.querySelector("[data-history-sentinel]")!;
      const checkSlot = () => {
        expect(getComputedStyle(slot).height).toBe("60px");
        expect(getComputedStyle(slot).overflowAnchor).toBe("none");
        expect(screen.getByRole("button", { name: "Ver revisão 1" })).toBe(
          first,
        );
      };
      checkSlot();
      const intersect = () =>
        enter(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        );
      act(() => {
        intersect();
        intersect();
      });
      await screen.findByRole("status", {
        name: "Carregando histórico de alterações",
      });
      checkSlot();
      expect(request).toHaveBeenCalledTimes(2);
      await act(async () => finish(page(1)));
      await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
      checkSlot();
      expect(
        screen.getAllByRole("button", { name: /Ver revisão/ }),
      ).toHaveLength(empty ? 1 : 2);
      act(intersect);
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      style.remove();
    }
  },
);

it("does not append an old plan's pending next page after selection changes", async () => {
  const seed = makeSeed(),
    item = seed.plans[0];
  const other = { ...item, id: uuid(8200), planId: uuid(8201), revision: 99 };
  const api = createMockApi({ seed, delay: 0 });
  let enter: IntersectionObserverCallback = () => {};
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        enter = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const page = (record: typeof item, hasMore = false) => ({
    items: [record],
    offset: 0,
    limit: 1,
    total: hasMore ? 2 : 1,
    hasMore,
    nextOffset: hasMore ? 1 : null,
  });
  let finish!: (value: ReturnType<typeof page>) => void;
  vi.spyOn(api, "revisions").mockImplementation(
    async (_task, plan, filters) => {
      if (plan === other.planId) return page(other);
      if (filters?.offset)
        return new Promise((resolve) => {
          finish = resolve;
        });
      return page(item, true);
    },
  );
  const draw = (current: typeof item) => (
    <ApiProvider api={api}>
      <PlanHistory item={current} onSelect={() => {}} />
    </ApiProvider>
  );
  const view = render(draw(item));
  await screen.findByRole("button", { name: `Ver revisão ${item.revision}` });
  act(() =>
    enter(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    ),
  );
  await screen.findByRole("status", {
    name: "Carregando histórico de alterações",
  });
  view.rerender(draw(other));
  const newRow = await screen.findByRole("button", { name: "Ver revisão 99" });
  await act(async () =>
    finish(page({ ...item, id: uuid(8202), revision: 88 })),
  );
  expect(screen.queryByRole("button", { name: "Ver revisão 88" })).toBeNull();
  expect(screen.getByRole("button", { name: "Ver revisão 99" })).toBe(newRow);
  expect(screen.getAllByRole("button", { name: /Ver revisão/ })).toHaveLength(
    1,
  );
});
