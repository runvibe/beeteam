import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids, makeSeed } from "@/api/seed";
import { App } from "@/App";
import { TaskMode } from "./settings";
import { TaskOverview } from "./task-detail-layout";

it("shares section selection with deep links and retains the autonomy form across sections", async () => {
  window.history.replaceState(
    {},
    "",
    `/tasks/${ids.task}?tab=specification&from=%2Fboards&comments.offset=10`,
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  const section = await screen.findByLabelText("Seção da tarefa");
  expect(section).toHaveValue("specification");
  const autonomy = screen.getByRole("combobox", {
    name: "Configuração individual",
  });
  await userEvent.selectOptions(section, "overview");
  expect(
    await screen.findByRole("heading", { name: "Resumo atual do trabalho" }),
  ).toBeVisible();
  expect(new URLSearchParams(location.search).get("from")).toBe("/boards");
  expect(new URLSearchParams(location.search).get("comments.offset")).toBe(
    "10",
  );
  expect(
    screen.getByRole("combobox", { name: "Configuração individual" }),
  ).toBe(autonomy);
  await userEvent.click(
    screen.getByRole("button", { name: /Detalhes da tarefa/ }),
  );
  await userEvent.click(screen.getByRole("tab", { name: "Planos" }));
  await waitFor(() => expect(section).toHaveValue("plans"));
  expect(
    screen.getByRole("combobox", { name: "Configuração individual" }),
  ).toBe(autonomy);
});

it("keeps an archived task read-only and separates empty work fields", () => {
  const task = {
    ...makeSeed().tasks[0],
    archivedAt: "2026-10-30T00:00:00Z",
    currentSummary: "",
    description: "",
    progress: { percent: 0, note: "" },
  };
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <TaskMode task={task} />
      <TaskOverview task={task} />
    </ApiProvider>,
  );
  expect(
    screen.queryByRole("combobox", { name: "Configuração individual" }),
  ).toBeNull();
  expect(screen.getByText("Task arquivada: somente leitura.")).toBeVisible();
  expect(screen.getByText("Sem atualização registrada")).toBeVisible();
  expect(screen.getByText("Nenhuma descrição registrada")).toBeVisible();
  expect(
    screen.getByText("Nenhuma nota de andamento registrada"),
  ).toBeVisible();
});

it("keeps execution summary content grouped with complete deliveries and pending items", async () => {
  window.history.replaceState({}, "", `/tasks/${ids.task}?tab=summaries`);
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  const deliveries = await screen.findByRole("region", { name: "Entregas" });
  expect(within(deliveries).getByText("Notas da descoberta")).toBeVisible();
  const pending = screen.getByRole("region", { name: "Pendências" });
  expect(within(pending).getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText(/Pontos de entrada inventariados/)).toBeVisible();
  expect(new URLSearchParams(location.search).get("tab")).toBe("summaries");
});

it("announces a blocked task with its complete reason in one alert", async () => {
  const seed = makeSeed();
  seed.tasks[0].block = {
    ...seed.tasks[0].block,
    blocked: true,
    reason: "Aguardando revisão de acessibilidade.",
  };
  window.history.replaceState({}, "", `/tasks/${ids.task}`);
  render(
    <ApiProvider api={createMockApi({ delay: 0, seed })}>
      <App />
    </ApiProvider>,
  );
  const alert = await screen.findByRole("alert");
  expect(within(alert).getByText("Task bloqueada")).toBeVisible();
  expect(
    within(alert).getByText("Aguardando revisão de acessibilidade."),
  ).toBeVisible();
  expect(alert.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});
