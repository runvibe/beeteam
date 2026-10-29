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
  const trigger = screen.getByRole("button", { name: "Buscar agentes" });
  await user.click(trigger);
  const input = screen.getByRole("searchbox", { name: "Buscar agentes" });
  expect(input).toHaveFocus();
  await user.type(input, "Lia");
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("data-active", "true");
  expect(location.search).toContain("agents.name=Lia");
  await user.click(screen.getByRole("button", { name: "Papel" }));
  await user.click(screen.getByRole("radio", { name: "Colaborador" }));
  expect(location.search).toContain("agents.role=collaborator");
  await user.keyboard("{Escape}");
  window.history.back();
  await waitFor(() => expect(location.search).not.toContain("agents.role="));
  expect(location.search).toContain("agents.name=Lia");
  await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(location.search).not.toContain("agents.name=");
  expect(location.search).toContain("agents.limit=1");
});

it("keeps entity search, option pagination and selected values reachable inside the popover", async () => {
  window.history.replaceState({}, "", "/agents?selector-teams-Time.limit=1");
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
  await screen.findByRole("textbox", { name: "Buscar opções de Time" });
  const popup = screen.getByRole("dialog", { name: "Time" });
  await user.click(within(popup).getByRole("button", { name: "Próxima" }));
  await user.click(
    await within(popup).findByRole("radio", { name: second.name }),
  );
  expect(new URLSearchParams(location.search).get("agents.teamId")).toBe(
    second.id,
  );
  await user.click(within(popup).getByRole("button", { name: "Anterior" }));
  expect(
    await within(popup).findByRole("radio", { name: second.name }),
  ).toHaveAttribute("aria-checked", "true");
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Time" })).toHaveAttribute(
    "data-active",
    "true",
  );
});
