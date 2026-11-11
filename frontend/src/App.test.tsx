import { openSearch } from "@/test/filter";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { App } from "./App";
import { ApiProvider } from "./api/context";
import { createMockApi } from "./api/mock";
import { useChatPanel } from "./state/chat-panel";

import { ids } from "./api/seed";
describe("Bee Team interface", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/boards");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  it("moves the content panel from its header without dragging", async () => {
    useChatPanel.setState(useChatPanel.getInitialState());
    useChatPanel.setState({ open: true });
    render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <App />
      </ApiProvider>,
    );
    const topbar = document.querySelector(".topbar") as HTMLElement;
    await userEvent.click(
      within(topbar).getByRole("button", { name: "Mover conteúdo para a direita" }),
    );
    expect(document.querySelector(".chat-workspace")).toHaveAttribute(
      "data-panel-order",
      "sessions,chat,content",
    );
    expect(useChatPanel.getState().side).toBe("left");
  });
  it("keeps global controls in the rail and contextual filters in the compact header", async () => {
    render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <App />
      </ApiProvider>,
    );
    const topbar = document.querySelector(".topbar") as HTMLElement;
    const rail = document.querySelector(".navigation-footer") as HTMLElement;
    expect(
      within(rail).getByRole("button", { name: "Configurações globais" }),
    ).toBeVisible();
    expect(
      within(rail).getByRole("button", { name: /Ativar tema/ }),
    ).toBeVisible();
    expect(
      within(topbar).getByRole("button", { name: "Buscar boards" }),
    ).toBeVisible();
    await userEvent.click(
      await screen.findByRole("link", { name: "Lançamento do produto" }),
    );
    expect(
      await within(topbar).findByRole("button", {
        name: "Configurações do board",
      }),
    ).toBeVisible();
    expect(
      screen.queryByText(/Tasks principais · subtasks/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Atualizações registradas, sem indicação/),
    ).not.toBeInTheDocument();
  });
  it("keeps filtered board context while the task breadcrumb follows cross-board ancestry", async () => {
    render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <App />
      </ApiProvider>,
    );
    await userEvent.click(
      await screen.findByRole("link", { name: "Lançamento do produto" }),
    );
    const search = await openSearch("Buscar tasks");
    await userEvent.type(search, "Mapear");
    await userEvent.click(
      await screen.findByRole("link", {
        name: "Mapear a jornada de primeiro uso",
      }),
    );
    let dialog = await screen.findByRole("region", { name: "Task" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Subtasks" }),
    );
    await userEvent.click(
      await within(dialog).findByRole("button", {
        name: "Descrever hipóteses da jornada",
      }),
    );
    dialog = await screen.findByRole("region", { name: "Task" });
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Subtasks" }),
    );
    await userEvent.click(
      await within(dialog).findByRole("button", {
        name: "Validar hipóteses com pesquisa",
      }),
    );
    dialog = await screen.findByRole("region", { name: "Task" });
    expect(document.querySelector(".task-detail-hero .task-path")).toBeNull();
    expect(document.querySelector(".task-detail-hero")?.firstElementChild).toHaveClass("task-detail-heading");
    const path = screen.getByRole("navigation", { name: "Caminho" });
    expect(
      await within(path).findByText("Pesquisa & estratégia"),
    ).toBeInTheDocument();
    expect(
      await within(path).findByText("Lançamento do produto"),
    ).toBeInTheDocument();
    expect(
      await within(path).findByRole("link", {
        name: "Mapear a jornada de primeiro uso",
      }),
    ).toBeInTheDocument();
    expect(
      within(path).getByRole("link", {
        name: "Descrever hipóteses da jornada",
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(
        screen.getByRole("navigation", { name: "Caminho compacto" }),
      ).getByRole("button", { name: "Voltar" }),
    );
    await userEvent.click(
      within(
        screen.getByRole("navigation", { name: "Caminho compacto" }),
      ).getByRole("button", { name: "Voltar" }),
    );
    await userEvent.click(
      within(
        screen.getByRole("navigation", { name: "Caminho compacto" }),
      ).getByRole("button", { name: "Voltar" }),
    );
    expect(await openSearch("Buscar tasks")).toHaveValue("Mapear");
    expect(
      screen.getByRole("heading", { name: "Lançamento do produto" }),
    ).toBeInTheDocument();
  });
  it("returns from a task page to the agent activities and its filter", async () => {
    render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <App />
      </ApiProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Recursos de Agentes" }),
    );
    await userEvent.click(await screen.findByRole("link", { name: "Lia" }));
    const agent = await screen.findByRole("region", { name: "Agente" });
    await userEvent.click(within(agent).getByRole("tab", { name: "Tasks" }));
    const filter = await openSearch("Buscar tasks do agente");
    await userEvent.type(filter, "Mapear");
    await userEvent.click(
      await within(agent).findByRole("button", {
        name: "Mapear a jornada de primeiro uso",
      }),
    );
    expect(await screen.findByRole("region", { name: "Task" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      within(
        screen.getByRole("navigation", { name: "Caminho compacto" }),
      ).getByRole("button", { name: "Voltar" }),
    );
    const restored = await screen.findByRole("region", { name: "Agente" });
    expect(
      within(restored).getByRole("tab", { name: "Tasks" }),
    ).toHaveAttribute("data-state", "active");
    expect(await openSearch("Buscar tasks do agente")).toHaveValue("Mapear");
  });
  it("saves a profile through the adapter without changing organizational bindings", async () => {
    const api = createMockApi({ delay: 0 });
    const original = await api.get("agents", ids.agent);
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Recursos de Agentes" }),
    );
    await userEvent.click(await screen.findByRole("link", { name: "Lia" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Configurar" }),
    );
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Nome", { exact: true });
    await userEvent.clear(input);
    await userEvent.type(input, "Lia revisada");
    await userEvent.tab();
    expect(
      await within(dialog).findByRole("heading", { name: "Lia revisada" }),
    ).toBeInTheDocument();
    expect((await api.get("agents", ids.agent)).bindings).toEqual(
      original.bindings,
    );
  });
  it("opens a task, reads its real subtasks and never offers dispatch", async () => {
    render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <App />
      </ApiProvider>,
    );
    await userEvent.click(
      await screen.findByRole("link", { name: /Lançamento do produto/ }),
    );
    await userEvent.click(
      await screen.findByRole("link", {
        name: "Mapear a jornada de primeiro uso",
      }),
    );
    const dialog = await screen.findByRole("region", { name: "Task" });
    expect(within(dialog).getByText("Autor")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Subtasks" }),
    );
    expect(
      await within(dialog).findByRole("button", {
        name: /Descrever hipóteses/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Executar|Aprovar|Despachar/ }),
    ).not.toBeInTheDocument();
  });
  it("shows an actionable error instead of fabricated data", async () => {
    render(
      <ApiProvider api={createMockApi({ delay: 0, fail: true })}>
        <App />
      </ApiProvider>,
    );
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Tentar novamente" }).length,
    ).toBeGreaterThan(0);
  });
});
