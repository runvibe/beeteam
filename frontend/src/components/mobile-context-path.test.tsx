import { within, act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { BreadcrumbName } from "./mobile-context-path";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";

it("animates only a measured overflow and keeps one complete accessible name", () => {
  const width = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(100);
  const content = vi
    .spyOn(HTMLElement.prototype, "scrollWidth", "get")
    .mockReturnValue(340);
  try {
    const { container, rerender } = render(
      <BreadcrumbName text="Nome completo extremamente longo" />,
    );
    expect(container.firstChild).toHaveAttribute("data-overflow", "true");
    expect(container.firstChild).toHaveStyle({
      "--breadcrumb-travel": "-240px",
    });
    expect(
      screen.getAllByText("Nome completo extremamente longo"),
    ).toHaveLength(1);
    content.mockReturnValue(70);
    rerender(<BreadcrumbName text="Curto" />);
    expect(container.firstChild).toHaveAttribute("data-overflow", "false");
  } finally {
    width.mockRestore();
    content.mockRestore();
  }
});
it("returns to the filtered origin without requiring existing browser history", async () => {
  const from = `/boards/${ids.board}?kanban.blocked=true`;
  window.history.replaceState(
    {},
    "",
    `/tasks/${ids.task}?from=${encodeURIComponent(from)}`,
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  await screen.findByRole("region", { name: "Task" });
  await userEvent.click(
    within(
      screen.getByRole("navigation", { name: "Caminho compacto" }),
    ).getByRole("button", { name: "Voltar" }),
  );
  await waitFor(() => expect(location.pathname + location.search).toBe(from));
});
it("uses a safe parent fallback when a direct task URL has an unsafe origin", async () => {
  window.history.replaceState(
    {},
    "",
    `/tasks/${ids.task}?from=https%3A%2F%2Fexample.com`,
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  await screen.findByRole("region", { name: "Task" });
  await act(async () =>
    userEvent.click(
      within(
        screen.getByRole("navigation", { name: "Caminho compacto" }),
      ).getByRole("button", { name: "Voltar" }),
    ),
  );
  await waitFor(() => expect(location.pathname).toBe(`/boards/${ids.board}`));
});
