import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";
import { setLocalePreference } from "@/i18n";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(url: string, mobile = false) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("max-width: 1055")
      ? mobile
      : q.includes("min-width: 1056")
        ? !mobile
        : false,
    addEventListener() {},
    removeEventListener() {},
  }));
  window.history.replaceState({}, "", url);
  return render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
}
it("shows the agent heading and context while preserving all three tabs across language changes", async () => {
  setup(`/agents/${ids.agent}?agent.tab=chats`);
  const heading = await screen.findByRole("heading", {
    name: "Lia",
    level: 1,
  });
  expect(heading.closest(".sr-only")).toBeNull();
  expect(
    screen.getByRole("complementary", { name: "Detalhes do agente" }),
  ).toBeVisible();
  expect(screen.getAllByRole("tab")).toHaveLength(3);
  const tab = screen.getByRole("tab", { name: "Chats" });
  await userEvent.click(tab);
  act(() => setLocalePreference("en"));
  expect(screen.getByRole("heading", { name: "Lia", level: 1 })).toBe(
    heading,
  );
  expect(screen.getByRole("tab", { name: "Chats" })).toBe(tab);
  expect(tab).toHaveFocus();
  expect(location.search).toContain("agent.tab=chats");
});
it("gives teams a visible header and sidebar without inventing tabs", async () => {
  setup(`/teams/${ids.team}`);
  const heading = await screen.findByRole("heading", {
    name: "Produto & engenharia",
    level: 1,
  });
  expect(heading.closest(".sr-only")).toBeNull();
  const context = screen.getByRole("complementary", {
    name: "Detalhes do time",
  });
  expect(
    within(context).getByRole("button", { name: "Editar metadados do time" }),
  ).toBeVisible();
  expect(screen.queryByRole("tab")).toBeNull();
  expect(screen.getByText("Boards geridos")).toBeVisible();
});
it("opens agent mobile context as a screen and restores the same selected tab", async () => {
  setup(`/agents/${ids.agent}?agent.tab=chats&from=%2Fagents`, true);
  const tab = await screen.findByRole("tab", { name: "Chats" });
  await userEvent.click(
    screen.getByRole("button", { name: "Detalhes do agente" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Detalhes do agente" }),
  ).toHaveFocus();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("tab")).toBeNull();
  await userEvent.click(
    screen.getByRole("button", { name: "Voltar ao agente" }),
  );
  expect(await screen.findByRole("tab", { name: "Chats" })).toBe(tab);
  expect(tab).toHaveAttribute("data-state", "active");
});

it("keeps mobile settings accessible and the same draft through a locale change", async () => {
  setup(`/agents/${ids.agent}?agent.tab=profile`, true);
  await screen.findByRole("tab", { name: "Perfil" });
  await userEvent.click(
    screen.getByRole("button", { name: "Detalhes do agente" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Configurar" }));
  const dialog = await screen.findByRole("dialog");
  const name = within(dialog).getByRole("textbox", { name: "Nome" });
  await userEvent.click(name);
  act(() => setLocalePreference("en"));
  expect(
    within(screen.getByRole("dialog")).getByRole("textbox", { name: "Name" }),
  ).toBe(name);
  expect(name).toHaveFocus();
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
  );
  expect(
    screen.getByRole("heading", { name: "Agent details" }),
  ).toBeVisible();
  expect(location.search).toContain("agent.view=details");
});
it("returns from direct mobile team details to the same team with independent pager queries", async () => {
  setup(
    `/teams/${ids.team}?team.view=details&members.offset=1&managedBoards.offset=2`,
    true,
  );
  await screen.findByRole("heading", { name: "Detalhes do time" });
  await userEvent.click(
    screen.getByRole("button", { name: "Voltar ao time" }),
  );
  expect(
    await screen.findByRole("heading", {
      name: "Produto & engenharia",
      level: 1,
    }),
  ).toBeVisible();
  expect(location.search).toContain("members.offset=1");
  expect(location.search).toContain("managedBoards.offset=2");
  expect(location.search).not.toContain("team.view");
});

it.each([
  ["teams", ids.team, "Time", "Detalhes do time", "Voltar ao time"],
  ["tasks", ids.task, "Task", "Detalhes da tarefa", "Voltar à tarefa"],
])(
  "adapts %s details as the available content width changes",
  async (resource, id, label, detailsLabel, backLabel) => {
    let contentWidth = 1200;
    const observers = new Set<MainWidthObserver>();
    const originalWidth = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "clientWidth",
    )!.get!;
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(
      function (this: Element) {
        return this.classList.contains("main-shell")
          ? contentWidth
          : originalWidth.call(this);
      },
    );
    class MainWidthObserver implements ResizeObserver {
      private readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        if (target.classList.contains("main-shell")) observers.add(this);
      }
      unobserve() {}
      disconnect() {
        observers.delete(this);
      }
      notify() {
        this.callback([], this);
      }
    }
    vi.stubGlobal("ResizeObserver", MainWidthObserver);
    setup(`/${resource}/${id}`);
    const region = await screen.findByRole("region", { name: label });
    await waitFor(() =>
      expect(region.querySelector(".detail-context")).toBeInTheDocument(),
    );
    const primary = region.querySelector(".detail-primary")!;
    const context = region.querySelector(".detail-context")!;
    expect(region).toHaveAttribute("data-detail-compact", "false");
    expect(context).not.toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name: detailsLabel })).toBeNull();

    act(() => {
      contentWidth = 987;
      observers.forEach((observer) => observer.notify());
    });
    expect(region).toHaveAttribute("data-detail-compact", "true");
    act(() => {
      contentWidth = 988;
      observers.forEach((observer) => observer.notify());
    });
    expect(region).toHaveAttribute("data-detail-compact", "false");

    act(() => {
      contentWidth = 252;
      observers.forEach((observer) => observer.notify());
    });
    expect(region).toHaveAttribute("data-detail-compact", "true");
    expect(context).toHaveAttribute("hidden");
    const info = screen.getByRole("button", { name: detailsLabel });
    await userEvent.click(info);
    expect(primary).toHaveAttribute("hidden");
    expect(context).not.toHaveAttribute("hidden");
    expect(screen.getByRole("heading", { name: detailsLabel })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: backLabel }));
    expect(primary).not.toHaveAttribute("hidden");
    expect(info).toHaveFocus();
    await userEvent.click(info);

    act(() => {
      contentWidth = 1200;
      observers.forEach((observer) => observer.notify());
    });
    expect(region).toHaveAttribute("data-detail-compact", "false");
    expect(primary).not.toHaveAttribute("hidden");
    expect(context).not.toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name: detailsLabel })).toBeNull();
  },
);

it.each([
  ["agents", ids.agent, "Agente"],
  ["teams", ids.team, "Time"],
])(
  "uses the global return navigation without a duplicate in %s content",
  async (resource, id, label) => {
    setup(`/${resource}/${id}`);
    const region = await screen.findByRole("region", { name: label });
    expect(
      within(region).queryByRole("button", { name: "Voltar" }),
    ).toBeNull();
    const compact = screen.getByRole("navigation", {
      name: "Caminho compacto",
    });
    await userEvent.click(
      within(compact).getByRole("button", { name: "Voltar" }),
    );
    expect(location.pathname).toBe(`/${resource}`);
  },
);

it.each([false, true])(
  "keeps agent associations only in responsive context (mobile=%s)",
  async (mobile) => {
    setup(`/agents/${ids.agent}`, mobile);
    await screen.findByRole("tab", { name: "Perfil" });
    expect(
      within(screen.getByRole("tabpanel")).queryByRole("heading", {
        name: "Vínculos",
      }),
    ).toBeNull();
    if (mobile)
      await userEvent.click(
        screen.getByRole("button", { name: "Detalhes do agente" }),
      );
    const context = screen.getByRole("complementary", {
      name: "Detalhes do agente",
    });
    expect(
      within(context).getByRole("heading", { name: "Vínculos" }),
    ).toBeVisible();
    expect(
      await within(context).findByRole("button", { name: /Worker/ }),
    ).toBeVisible();
  },
);
