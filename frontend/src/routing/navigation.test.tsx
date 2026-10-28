import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";
import { navigate, safeOrigin } from "./location";
const setup = (url: string) => {
  window.history.replaceState({}, "", url);
  const api = createMockApi({ delay: 0 });
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  return api;
};
beforeEach(() => window.history.replaceState({}, "", "/boards"));
it("reconstructs a direct board filter and page size, opens card body, and returns through history after tab changes", async () => {
  setup(`/boards/${ids.board}?kanban.title=Mapear&kanban.limit=1`);
  const link = await screen.findByRole("link", {
    name: "Mapear a jornada de primeiro uso",
  });
  const card = link.closest('[data-slot="card"]')!;
  expect(
    within(card as HTMLElement).getByText(/Jornada inicial mapeada/),
  ).toBeVisible();
  await userEvent.click(
    within(card as HTMLElement).getByText(/Jornada inicial mapeada/),
  );
  expect(location.pathname).toBe("/tasks/mapear-a-jornada-de-primeiro-uso");
  await screen.findByRole("region", { name: "Task" });
  const topPath = screen.getByRole("navigation", { name: "Caminho" });
  expect(
    await within(topPath).findByRole("link", { name: "Lançamento do produto" }),
  ).toBeVisible();
  expect(
    within(topPath).getByText("Mapear a jornada de primeiro uso"),
  ).toHaveAttribute("aria-current", "page");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Subtasks" }));
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(
    await screen.findByRole("searchbox", { name: "Buscar tasks" }),
  ).toHaveValue("Mapear");
  expect(new URLSearchParams(location.search).get("kanban.limit")).toBe("1");
  window.history.forward();
  await waitFor(() =>
    expect(location.pathname).toBe("/tasks/mapear-a-jornada-de-primeiro-uso"),
  );
  expect(await screen.findByRole("region", { name: "Task" })).toBeVisible();
});
it("uses a deterministic direct-task fallback and rejects external return URLs", async () => {
  setup(`/tasks/${ids.task}?from=https%3A%2F%2Fevil.example&tab=unknown`);
  await screen.findByRole("heading", {
    name: "Mapear a jornada de primeiro uso",
  });
  expect(screen.getByRole("tab", { name: /Vis/ })).toHaveAttribute(
    "data-state",
    "active",
  );
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  await waitFor(() => expect(location.pathname).toBe(`/boards/${ids.board}`));
  expect(safeOrigin("//evil.example")).toBeNull();
});
it("reads invalid query defaults and resets offsets without dropping page size", async () => {
  const api = setup(
    "/agents?agents.name=Lia&agents.offset=invalid&agents.limit=1&agents.archived=bad",
  );
  const spy = vi.spyOn(api, "list");
  expect(await screen.findByRole("link", { name: "Lia" })).toBeVisible();
  const search = screen.getByRole("searchbox");
  await userEvent.clear(search);
  await waitFor(() =>
    expect(new URLSearchParams(location.search).has("agents.offset")).toBe(
      false,
    ),
  );
  expect(new URLSearchParams(location.search).get("agents.limit")).toBe("1");
  expect(spy).toHaveBeenCalledWith(
    "agents",
    "",
    expect.objectContaining({ offset: 0, limit: 1, archived: false }),
  );
});
it("preserves the executor action instead of opening the task and exposes settings routes", async () => {
  setup(`/boards/${ids.board}`);
  const link = await screen.findByRole("link", {
    name: "Mapear a jornada de primeiro uso",
  });
  const card = link.closest('[data-slot="card"]')!;
  await userEvent.click(
    await within(card as HTMLElement).findByRole("button", { name: /Lia/ }),
  );
  expect(location.pathname).toBe("/agents/lia");
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.click(
    await screen.findByRole("button", { name: "Configurar" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(location.pathname).toBe("/agents/lia/settings");
  await userEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  await waitFor(() => expect(location.pathname).toBe(`/boards/${ids.board}`));
  navigate(`/teams/${ids.team}/settings`);
  expect(await screen.findByRole("dialog")).toBeVisible();
});

it("opens a board card body and restores list query through its breadcrumb", async () => {
  setup("/boards?boards.name=Lan&boards.limit=1&boards.offset=0");
  const link = await screen.findByRole("link", {
    name: "Lançamento do produto",
  });
  const card = link.querySelector('[data-slot="card"]')!;
  expect(card.querySelector('[data-slot="card-title"] a')).toBeNull();
  const selection = vi
    .spyOn(window, "getSelection")
    .mockReturnValue({ toString: () => "selected text" } as Selection);
  await userEvent.click(within(card as HTMLElement).getByText(/Da descoberta/));
  expect(location.pathname).toBe("/boards");
  selection.mockRestore();
  await userEvent.click(within(card as HTMLElement).getByText(/Da descoberta/));
  expect(location.pathname).toBe(`/boards/${ids.board}`);
  expect(new URLSearchParams(location.search).get("from")).toBe(
    "/boards?boards.name=Lan&boards.limit=1&boards.offset=0",
  );
  await userEvent.click(
    within(screen.getByRole("navigation", { name: "Caminho" })).getByRole(
      "button",
      { name: "Boards" },
    ),
  );
  expect(
    await screen.findByRole("searchbox", { name: "Buscar boards" }),
  ).toHaveValue("Lan");
  expect(new URLSearchParams(location.search).get("boards.limit")).toBe("1");
  const restored = await screen.findByRole("link", {
    name: "Lançamento do produto",
  });
  restored.focus();
  await userEvent.keyboard("{Enter}");
  expect(location.pathname).toBe(`/boards/${ids.board}`);
});
