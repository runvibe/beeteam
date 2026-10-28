import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { App } from "./App";
import { ApiProvider } from "./api/context";
import { createMockApi } from "./api/mock";

import { ids } from "./api/seed";
describe("Bee Team interface", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/boards");
    window.dispatchEvent(new PopStateEvent("popstate"));
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
    const search = screen.getByRole("searchbox", { name: "Buscar tasks" });
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
    const path = within(dialog).getByRole("navigation", {
      name: "Caminho da task",
    });
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
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(
      await screen.findByRole("searchbox", { name: "Buscar tasks" }),
    ).toHaveValue("Mapear");
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
    const filter = within(agent).getByRole("searchbox");
    await userEvent.type(filter, "Mapear");
    await userEvent.click(
      await within(agent).findByRole("button", {
        name: "Mapear a jornada de primeiro uso",
      }),
    );
    expect(await screen.findByRole("region", { name: "Task" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    const restored = await screen.findByRole("region", { name: "Agente" });
    expect(
      within(restored).getByRole("tab", { name: "Tasks" }),
    ).toHaveAttribute("data-state", "active");
    expect(within(restored).getByRole("searchbox")).toHaveValue("Mapear");
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
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Salvar perfil" }),
    );
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
        name: /Mapear a jornada de primeiro uso/,
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
