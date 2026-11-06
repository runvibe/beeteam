import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { App } from "@/App";
afterEach(() => vi.unstubAllGlobals());
it.each([
  ["overview", true],
  ["overview", false],
  ["children", true],
  ["children", false],
] as const)(
  "loads %s subtasks in batches of ten using the correct root (desktop=%s)",
  async (tab, desktop) => {
    const seed = makeSeed();
    const parent = seed.tasks[0];
    seed.tasks = [
      parent,
      ...Array.from({ length: 25 }, (_, i) => ({
        ...parent,
        id: uuid(7000 + i),
        slug: `child-${i}`,
        parentId: parent.id,
        title: `Child ${i}`,
        position: String(i).padStart(4, "0"),
        deletedAt: null,
        archivedAt: null,
      })),
    ];
    window.history.replaceState({}, "", `/tasks/${parent.id}?tab=${tab}`);
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(min-width: 1056px)" ? desktop : false,
        addEventListener() {},
        removeEventListener() {},
      })),
    );
    let intersect = () => {};
    let root: Element | Document | null | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        options?: IntersectionObserverInit;
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          this.callback = callback;
          this.options = options;
        }
        observe(target: Element) {
          if (target.getAttribute("data-task-record-sentinel") === "tasks") {
            root = this.options?.root;
            intersect = () =>
              this.callback(
                [{ isIntersecting: true }] as IntersectionObserverEntry[],
                {} as IntersectionObserver,
              );
          }
        }
        disconnect() {}
      },
    );
    const api = createMockApi({ delay: 0, seed });
    const list = vi.spyOn(api, "list");
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );
    await screen.findByRole("button", { name: "Child 9" });
    const requests = () =>
      list.mock.calls.filter(
        (call) => call[0] === "tasks" && call[2]?.parentId === parent.id,
      );
    expect(root).toBe(
      tab === "overview" ? document.querySelector(".overview-subtask-list[data-list-scroll]") : desktop ? document.querySelector("[data-detail-scroll]") : null,
    );
    expect(requests().map((call) => call[2]?.offset)).toEqual([0]);
    expect(screen.queryByRole("button", { name: "Child 10" })).toBeNull();
    act(() => intersect());
    await screen.findByRole("button", { name: "Child 19" });
    act(() => intersect());
    await screen.findByRole("button", { name: "Child 24" });
    act(() => intersect());
    await waitFor(() =>
      expect(requests().map((call) => call[2]?.offset)).toEqual([0, 10, 20]),
    );
    expect(requests().every((call) => call[2]?.limit === 10)).toBe(true);
    expect(screen.getAllByRole("button", { name: /^Child \d+$/ })).toHaveLength(
      25,
    );
  },
);
