import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";

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
  const brand = screen.getByRole("link", { name: "Bee Team — ir para boards" });
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
