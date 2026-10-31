import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, ids } from "@/api/seed";
import { App } from "@/App";

afterEach(() => vi.unstubAllGlobals());
it("shows a visual-only sidebar summary after the hero leaves, preserving tabs, URL and form identity", async () => {
  let enter: IntersectionObserverCallback = () => {};
  let root: Element | Document | null | undefined;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(min-width: 1056px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      callback: IntersectionObserverCallback;
      options: IntersectionObserverInit;
      constructor(
        callback: IntersectionObserverCallback,
        options: IntersectionObserverInit,
      ) {
        this.callback = callback;
        this.options = options;
      }
      observe(target: Element) {
        if (target.classList.contains("task-detail-hero")) {
          enter = this.callback;
          root = this.options.root;
        }
      }
      disconnect() {}
    },
  );
  const seed = makeSeed();
  seed.tasks[0].block = {
    ...seed.tasks[0].block,
    blocked: true,
    reason: "Aguardando decisão",
  };
  window.history.replaceState(
    {},
    "",
    `/tasks/${ids.task}?tab=overview&from=%2Fboards`,
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0, seed })}>
      <App />
    </ApiProvider>,
  );
  await screen.findByRole("heading", { name: seed.tasks[0].title });
  const summary = document.querySelector(".task-compact-header")!;
  const form = screen.getByRole("combobox", {
    name: "Configuração individual",
  });
  expect(root).toBe(document.querySelector("[data-detail-scroll]"));
  expect(summary).toHaveAttribute("data-visible", "false");
  const cross = (bottom: number, isIntersecting: boolean) =>
    act(() =>
      enter(
        [
          {
            isIntersecting,
            boundingClientRect: { bottom },
            rootBounds: { top: 0 },
          },
        ] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      ),
    );
  cross(-1, false);
  expect(summary).toHaveAttribute("data-visible", "true");
  expect(summary).toHaveAttribute("aria-hidden", "true");
  expect(summary.textContent).toContain("Aguardando decisão");
  expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(within(summary as HTMLElement).queryByRole("heading")).toBeNull();
  await userEvent.click(screen.getByRole("tab", { name: "Conversa" }));
  expect(
    screen.getByRole("combobox", { name: "Configuração individual" }),
  ).toBe(form);
  expect(new URLSearchParams(location.search).get("from")).toBe("/boards");
  cross(100, true);
  expect(summary).toHaveAttribute("data-visible", "false");
  expect(document.querySelector(".task-detail-hero")).toContainElement(
    screen.getByRole("heading", { name: seed.tasks[0].title }),
  );
});
it("does not observe a mobile header or introduce a second accessible summary", async () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const observe = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      disconnect() {}
    },
  );
  window.history.replaceState({}, "", `/tasks/${ids.task}`);
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  await screen.findByRole("heading", { name: makeSeed().tasks[0].title });
  expect(observe).not.toHaveBeenCalledWith(
    document.querySelector(".task-detail-hero"),
  );
  expect(document.querySelector(".task-compact-header")).toHaveAttribute(
    "data-visible",
    "false",
  );
  expect(screen.getAllByRole("progressbar")).toHaveLength(1);
});
