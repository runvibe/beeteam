import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
it("opens focused search, keeps URL filters through Escape/history, and clears from the toolbar", async () => {
  window.history.replaceState({}, "", "/agents?agents.limit=1");
  const user = userEvent.setup();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /filtros ativos/ }),
  ).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: "Buscar agentes" });
  await user.click(trigger);
  const input = screen.getByRole("searchbox", { name: "Buscar agentes" });
  expect(input).toHaveFocus();
  await user.type(input, "Lia");
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("data-active", "true");
  expect(location.search).toContain("agents.name=Lia");
  await user.click(trigger);
  expect(screen.getByRole("searchbox", { name: "Buscar agentes" })).toHaveValue(
    "Lia",
  );
  expect(
    screen.getByRole("searchbox", { name: "Buscar agentes" }),
  ).toHaveFocus();
  expect(
    screen.queryByRole("dialog", { name: "Buscar agentes" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Fechar buscar agentes" }),
  );
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  expect(location.search).toContain("agents.name=Lia");
  await user.click(screen.getByRole("button", { name: "Papel" }));
  await user.click(screen.getByRole("radio", { name: "Colaborador" }));
  expect(location.search).toContain("agents.role=collaborator");
  await user.keyboard("{Escape}");
  const summary = await screen.findByRole("button", {
    name: "Expandir 2 filtros ativos",
  });
  expect(summary).toHaveTextContent("Buscar agentes: Lia");
  await user.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Papel: Colaborador")).toBeVisible();
  await user.click(summary);
  await user.unhover(summary);
  expect(summary).toHaveAttribute("aria-expanded", "false");
  window.history.back();
  await waitFor(() => expect(location.search).not.toContain("agents.role="));
  expect(location.search).toContain("agents.name=Lia");
  await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(location.search).not.toContain("agents.name=");
  expect(location.search).toContain("agents.limit=1");
  expect(
    screen.queryByRole("button", { name: /filtros ativos/ }),
  ).not.toBeInTheDocument();
});

it("searches teams globally from a focused combobox and applies the selected suggestion", async () => {
  window.history.replaceState({}, "", "/agents");
  const api = createMockApi({ delay: 0 });
  const second = (
    await api.list("teams", "", { limit: 1, offset: 1, sortBy: "name" })
  ).items[0];
  const user = userEvent.setup();
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Time" }));
  const popup = screen.getByRole("dialog", { name: "Time" });
  const input = within(popup).getByRole("combobox", {
    name: "Buscar opções de Time",
  });
  expect(input).toHaveFocus();
  await within(popup).findByRole("option", { name: second.name });
  await user.type(input, second.name);
  await within(popup).findByRole("option", { name: second.name });
  await user.keyboard("{ArrowDown}{Enter}");
  expect(new URLSearchParams(location.search).get("agents.teamId")).toBe(
    second.id,
  );
  expect(
    within(popup).queryByRole("button", { name: "Próxima" }),
  ).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Time" })).toHaveAttribute(
    "data-active",
    "true",
  );
});
it("removes just one active filter from its tag with keyboard, resets pages and keeps other URL state", async () => {
  window.history.replaceState(
    {},
    "",
    "/agents?agents.name=Lia&agents.role=collaborator&agents.offset=5&agents.window=5:1&agents.limit=1",
  );
  const user = userEvent.setup();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  const removeSearch = await screen.findByRole("button", {
    name: "Remover filtro Buscar agentes: Lia",
  });
  removeSearch.focus();
  await user.keyboard("{Enter}");
  expect(location.search).not.toContain("agents.name");
  expect(location.search).not.toContain("agents.offset");
  expect(location.search).not.toContain("agents.window");
  expect(location.search).toContain("agents.role=collaborator");
  expect(location.search).toContain("agents.limit=1");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Remover filtro Papel: Colaborador" }),
  );
  expect(location.search).not.toContain("agents.role");
  expect(
    screen.queryByRole("button", { name: /filtros ativos/ }),
  ).not.toBeInTheDocument();
});

it("renders team purpose and multiparagraph context inside one clipping container", async () => {
  window.history.replaceState({}, "", "/teams");
  const api = createMockApi({ delay: 0 });
  const list = api.list.bind(api);
  api.list = (async (resource, scope, filters, signal) => {
    const page = await list(resource, scope, filters, signal);
    return resource === "teams"
      ? {
          ...page,
          items: page.items.map((item) => ({
            ...item,
            purpose: "Primeiro parágrafo",
            context: "Segundo parágrafo\n\nTerceiro parágrafo",
          })),
        }
      : page;
  }) as typeof api.list;
  const { container } = render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  await waitFor(() =>
    expect(container.querySelectorAll(".team-card").length).toBeGreaterThan(0),
  );
  for (const card of Array.from(container.querySelectorAll(".team-card"))) {
    expect(card.querySelectorAll(".card-excerpt")).toHaveLength(1);
    expect(card.querySelector(".card-excerpt")?.textContent).toBe(
      "Primeiro parágrafo\n\nSegundo parágrafo\n\nTerceiro parágrafo",
    );
  }
});
