import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, ids } from "@/api/seed";
import { App } from "@/App";

afterEach(() => vi.unstubAllGlobals());
it("shows an expandable sidebar summary after the hero leaves, preserving tabs, URL and form identity", async () => {
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
  expect(summary).toHaveAttribute("aria-hidden", "false");
  expect(summary).not.toHaveAttribute("inert");
  await userEvent.click(
    within(summary as HTMLElement).getByText("Descrição", {
      selector: "summary",
    }),
  );
  expect(summary.querySelector("details")).toHaveAttribute("open");
  expect(summary.textContent).toContain("Aguardando decisão");
  expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  expect(screen.getAllByRole("alert")).toHaveLength(1);

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

it.each([
  "overview",
  "specification",
  "children",
  "plans",
  "comments",
  "attachments",
  "summaries",
  "timeline",
])(
  "keeps ordered description and current synthesis above %s without overview duplication",
  async (tab) => {
    const seed = makeSeed();
    seed.tasks[0].description = "**Descrição no cabeçalho**";
    seed.tasks[0].currentSummary = "**Síntese no cabeçalho**";
    seed.tasks[0].block = { blocked: true, reason: "Aguardar autorização" };
    window.history.replaceState({}, "", `/tasks/${ids.task}?tab=${tab}`);
    render(
      <ApiProvider api={createMockApi({ delay: 0, seed })}>
        <App />
      </ApiProvider>,
    );
    await screen.findByRole("heading", { name: seed.tasks[0].title });
    const hero = document.querySelector(".task-detail-hero")!;
    const description = hero.querySelector(".task-header-description")!;
    const progress = hero.querySelector(".task-detail-state")!;
    const blocked = hero.querySelector(".task-blocked-alert")!;
    const summary = hero.querySelector(".task-summary-section")!;
    expect(
      description.compareDocumentPosition(progress) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      progress.compareDocumentPosition(blocked) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      blocked.compareDocumentPosition(summary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(description as HTMLElement).getByText("Descrição no cabeçalho")
        .tagName,
    ).toBe("STRONG");
    expect(
      within(summary as HTMLElement).getByText("Síntese no cabeçalho").tagName,
    ).toBe("STRONG");
    expect(
      document.querySelector(".task-detail-reading .task-summary-section"),
    ).toBeNull();
    expect(
      document.querySelector(".task-detail-reading .task-header-description"),
    ).toBeNull();
  },
);
