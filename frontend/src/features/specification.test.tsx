import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids, uuid } from "@/api/seed";
import { App } from "@/App";
it("restores specification tab with Markdown and renders empty task specification", async () => {
  window.history.replaceState({}, "", `/tasks/${ids.task}?tab=specification`);
  const view = render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: "Requisitos" }),
  ).toBeVisible();
  expect(screen.getByRole("tab", { name: "Especificação" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("table")).toBeVisible();
  view.unmount();
  window.history.replaceState({}, "", `/tasks/${uuid(101)}?tab=specification`);
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  expect(
    await screen.findByText("Nenhuma especificação registrada"),
  ).toBeVisible();
});
