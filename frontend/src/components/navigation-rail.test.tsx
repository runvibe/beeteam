import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { useChatPanel } from "@/state/chat-panel";
import { useSessionsSidebar } from "@/state/sessions-sidebar";
import { setLocalePreference } from "@/i18n";

it("uses a fixed icon navigation with keyboard tooltips and updates the active route", async () => {
  window.history.replaceState({}, "", "/boards");
  const user = userEvent.setup();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  expect(
    screen.queryByRole("button", {
      name: /Recolher navegação|Expandir navegação/,
    }),
  ).not.toBeInTheDocument();
  const brand = screen.getByRole("link", { name: "Bee Team - ir para boards" });
  expect(brand).toHaveTextContent("");
  const nav = screen.getByRole("navigation", { name: "Navegação principal" });
  const tasks = within(nav).getByRole("button", { name: "Tarefas" });
  expect(tasks).toHaveAttribute("aria-current", "page");
  expect(tasks).toHaveTextContent("");
  await user.tab();
  expect(brand).toHaveFocus();
  await user.tab();
  expect(tasks).toHaveFocus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Tarefas");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  await user.tab();
  const agents = within(nav).getByRole("button", {
    name: "Recursos de Agentes",
  });
  expect(agents).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(location.pathname).toBe("/agents");
  expect(agents).toHaveAttribute("aria-current", "page");
  expect(tasks).not.toHaveAttribute("aria-current");
  await user.click(within(nav).getByRole("button", { name: "Times" }));
  expect(location.pathname).toBe("/teams");
  expect(
    screen.getByRole("button", { name: "Configurações globais" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: /Ativar tema/ })).toBeVisible();
});

it("puts the chat toggle in the main navigation and opens and closes the panel", async () => {
  window.history.replaceState({}, "", "/boards");
  useChatPanel.setState({ teamId: null, picking: false, open: false });
  const user = userEvent.setup();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );

  const nav = screen.getByRole("navigation", { name: "Navegação principal" });
  const toggle = within(nav).getByRole("button", { name: "Chat com o líder" });
  expect(screen.getAllByRole("button", { name: "Chat com o líder" })).toHaveLength(1);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("complementary", { name: "Chat com o líder" })).toBeVisible();
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("complementary", { name: "Chat com o líder" })).toBeNull();
  within(nav).getByRole("button", { name: "Times" }).focus();
  await user.tab();
  expect(toggle).toHaveFocus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Chat com o líder");
});

it("keeps the navigation rail and its controls at most 75% of their former size", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync("src/navigation.css", "utf8");
  document.head.append(style);
  const pixels = (element: Element, value: string) => {
    const variable = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
    return Number.parseFloat(
      variable ? getComputedStyle(element).getPropertyValue(variable) : value,
    );
  };
  try {
    window.history.replaceState({}, "", "/boards");
    render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <App />
      </ApiProvider>,
    );
    const shell = document.querySelector(".app-shell.icon-navigation")!;
    const column = getComputedStyle(shell).gridTemplateColumns.split(/\s+/)[0];
    expect(pixels(shell, column)).toBeLessThanOrEqual(68 * 0.75);
    const rail = document.querySelector(".navigation-rail")!;
    const controls = rail.querySelectorAll(".navigation-logo, .navigation-button, .navigation-footer button, .navigation-footer a");
    expect(controls.length).toBeGreaterThan(0);
    for (const control of Array.from(controls)) {
      const { width, height } = getComputedStyle(control);
      expect(pixels(control, width)).toBeLessThanOrEqual(44 * 0.75);
      expect(pixels(control, height)).toBeLessThanOrEqual(44 * 0.75);
      expect(pixels(control, width)).toBeGreaterThanOrEqual(24);
      expect(pixels(control, height)).toBeGreaterThanOrEqual(24);
    }
  } finally {
    style.remove();
  }
});

it("keeps the breadcrumb header aligned with the main content gutter", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync("src/navigation.css", "utf8");
  document.head.append(style);
  try {
    render(
      <div className="app-shell icon-navigation">
        <div className="main-shell">
          <header className="topbar">
            <nav aria-label="Breadcrumb">Breadcrumb</nav>
          </header>
          <main>Content</main>
        </div>
      </div>,
    );
    const header = getComputedStyle(screen.getByRole("banner"));
    const main = getComputedStyle(screen.getByRole("main"));
    // JSDOM leaves logical padding unresolved in the physical properties.
    expect(header.paddingLeft).not.toBe("0px");
    expect(header.paddingRight).not.toBe("0px");
    expect(header.paddingInline).toBe("0.5rem");
    expect(main.paddingInline).toBe("0.5rem");
  } finally {
    style.remove();
  }
});

it("offers preset panel layouts in the navigation footer and persists the chosen order", async () => {
  setLocalePreference("en");
  window.history.replaceState({}, "", "/boards");
  useChatPanel.setState({
    teamId: null,
    picking: false,
    open: true,
    panelOrder: ["sessions", "content", "chat"],
    side: "right",
  });
  useSessionsSidebar.setState({ open: true, drawer: false });
  const user = userEvent.setup();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).queryByRole("button", { name: "Panel layouts" })).toBeNull();
  const footer = document.querySelector<HTMLElement>(".navigation-footer")!;
  const trigger = within(footer).getByRole("button", { name: "Panel layouts" });
  expect(trigger.parentElement).toBe(footer);
  expect(trigger).toHaveAttribute("title", "Panel layouts");
  expect(trigger).not.toHaveClass("navigation-button");
  await user.click(trigger);
  const layouts = screen.getByRole("radiogroup", { name: "Panel layouts" });
  expect(within(layouts).getAllByRole("radio")).toHaveLength(6);
  const option = within(layouts).getByRole("radio", { name: "Chat, Content, Sessions" });
  await user.click(option);
  expect(option).toBeChecked();
  expect(useChatPanel.getState()).toMatchObject({
    panelOrder: ["chat", "content", "sessions"],
    side: "left",
  });
  expect(document.querySelector(".chat-workspace")).toHaveAttribute(
    "data-panel-order",
    "chat,content,sessions",
  );
  expect(JSON.parse(localStorage.getItem("beeteam-chat-panel")!).state.panelOrder).toEqual([
    "chat", "content", "sessions",
  ]);
  expect(screen.queryByRole("button", { name: /Move (sessions|content|chat) to the/ })).toBeNull();
});
