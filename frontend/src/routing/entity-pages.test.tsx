import { openSearch } from "@/test/filter";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";
function setup(url: string) {
  window.history.replaceState({}, "", url);
  return render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
}
it("opens agent body with keyboard and restores filtered list, then forward/deep link", async () => {
  const view = setup("/agents?agents.name=Lia&agents.limit=1");
  const card = await screen.findByRole("link", { name: "Lia" });
  expect(card.querySelector("[data-slot=card-title] button")).toBeNull();
  const selection = vi
    .spyOn(window, "getSelection")
    .mockReturnValue({ toString: () => "text" } as Selection);
  await userEvent.click(within(card).getByText("Engenharia de produto"));
  expect(location.pathname).toBe("/agents");
  selection.mockRestore();
  card.focus();
  await userEvent.keyboard("{Enter}");
  expect(await screen.findByRole("region", { name: "Agente" })).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    within(screen.getByRole("navigation", { name: "Caminho" })).getByText(
      "Lia",
    ),
  ).toHaveAttribute("aria-current", "page");
  await userEvent.click(screen.getByRole("tab", { name: "Chats" }));
  const url = location.pathname + location.search;
  view.unmount();
  setup(url);
  expect(await screen.findByRole("tab", { name: "Chats" })).toHaveAttribute(
    "data-state",
    "active",
  );
  await userEvent.click(
    within(
      screen.getByRole("navigation", { name: "Caminho compacto" }),
    ).getByRole("button", { name: "Voltar" }),
  );
  expect(await openSearch("Buscar agentes")).toHaveValue("Lia");
  expect(new URLSearchParams(location.search).get("agents.limit")).toBe("1");
});
it("keeps team leader action separate and returns from board and settings to the exact team page", async () => {
  setup("/teams?teams.name=Produto&teams.limit=1");
  const link = await screen.findByRole("link", {
    name: "Produto & engenharia",
  });
  const card = link.closest("[data-slot=card]")! as HTMLElement;
  await userEvent.click(
    await within(card).findByRole("link", { name: "Abrir liderança: Theo" }),
  );
  expect(await screen.findByRole("region", { name: "Agente" })).toBeVisible();
  await userEvent.click(
    within(
      screen.getByRole("navigation", { name: "Caminho compacto" }),
    ).getByRole("button", { name: "Voltar" }),
  );
  await userEvent.click(
    await screen.findByText(
      /Ciclos curtos, decisões documentadas e revisão de entregas\./,
    ),
  );
  expect(await screen.findByRole("region", { name: "Time" })).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.click(
    await screen.findByRole("button", { name: "Lançamento do produto" }),
  );
  expect(location.pathname).toBe(`/boards/${ids.board}`);
  await userEvent.click(
    await within(
      screen.getByRole("navigation", { name: "Caminho compacto" }),
    ).findByRole("button", { name: "Voltar" }),
  );
  expect(await screen.findByRole("region", { name: "Time" })).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Editar metadados do time" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByText("Boards geridos")).toBeNull();
  await userEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(location.pathname).toBe("/teams/produto-engenharia");
  await userEvent.click(
    within(
      screen.getByRole("navigation", { name: "Caminho compacto" }),
    ).getByRole("button", { name: "Voltar" }),
  );
  expect(await openSearch("Buscar times")).toHaveValue("Produto");
  window.history.forward();
  await waitFor(() =>
    expect(location.pathname).toBe("/teams/produto-engenharia"),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("restores a direct settings URL to its profile with tab and pagination intact", async () => {
  setup(
    `/agents/${ids.agent}/settings?agent.tab=activities&activities.limit=1&activities.offset=1`,
  );
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
  expect(screen.getByRole("tab", { name: "Tasks" })).toHaveAttribute(
    "data-state",
    "active",
  );
  expect(location.search).toContain("activities.offset=1");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("opens collaborators from a team footer with team and role filters and a return URL", async () => {
  setup("/teams?teams.name=Produto");
  const teamLink = await screen.findByRole("link", {
    name: "Produto & engenharia",
  });
  const card = teamLink.closest("[data-slot=card]") as HTMLElement;
  const shortcut = within(card).getByRole("link", {
    name: /colaboradores do time Produto/,
  });
  expect(shortcut.closest("a")?.parentElement?.closest("a")).toBeNull();
  await userEvent.click(shortcut);
  expect(location.pathname).toBe("/agents");
  const params = new URLSearchParams(location.search);
  expect(params.get("agents.teamId")).toBe(ids.team);
  expect(params.get("agents.role")).toBe("collaborator");
  expect(params.get("from")).toBe("/teams?teams.name=Produto");
  await userEvent.click(
    await screen.findByRole("button", { name: "Expandir 2 filtros ativos" }),
  );
  expect(
    await screen.findByRole("button", { name: /Remover filtro Time:/ }),
  ).toBeInTheDocument();
});
