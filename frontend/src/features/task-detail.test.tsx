import { TaskDescription, TaskCurrentSummary } from "./task-header-content";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids, makeSeed } from "@/api/seed";
import { App } from "@/App";
import { TaskMode } from "./settings";
import { TaskOverview } from "./task-detail-layout";

it("reserves the outgoing panel height until conversation data arrives", async () => {
  window.history.replaceState({}, "", `/tasks/${ids.task}?tab=overview`);
  const api = createMockApi({ delay: 0 });
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = api.list.bind(api);
  vi.spyOn(api, "list").mockImplementation(async (...args) => {
    if (args[0] === "comments") await gate;
    return original(...args);
  });
  const bounds = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      return {
        top: 0,
        bottom: 600,
        height: this.classList.contains("task-detail-reading") ? 600 : 0,
      } as DOMRect;
    });
  try {
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );
    await screen.findByRole("tab", { name: "Conversa" });
    await userEvent.click(screen.getByRole("tab", { name: "Conversa" }));
    const panel = document.querySelector<HTMLElement>(".task-detail-reading")!;
    expect(panel.style.minHeight).toBe("600px");
    release();
    await waitFor(() => expect(panel.style.minHeight).toBe("0px"));
    expect(document.querySelector("[data-comment-id]")).not.toBeNull();
  } finally {
    release();
    bounds.mockRestore();
  }
});

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
  await screen.findByRole("tablist", { name: "Seção da tarefa" });
  expect(screen.getByRole("tab", { name: "Especificação" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    within(screen.getByRole("region", { name: "Task" })).queryByRole("button", {
      name: "Voltar",
    }),
  ).toBeNull();
  expect(
    within(screen.getByLabelText("Estado da tarefa")).queryByText("Status"),
  ).toBeNull();
  expect(
    within(
      screen.getByRole("complementary", { name: "Contexto da tarefa" }),
    ).getByRole("heading", { name: "Status" }),
  ).toBeVisible();
  expect(
    within(screen.getByLabelText("Estado da tarefa")).queryByText("Executor"),
  ).toBeNull();
  expect(
    within(
      screen.getByRole("complementary", { name: "Contexto da tarefa" }),
    ).getByText("Executor"),
  ).toBeVisible();
  expect(
    screen.queryByRole("navigation", { name: "Caminho da task" }),
  ).toBeNull();
  expect(screen.getByRole("navigation", { name: "Caminho" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Especificação" })).toBeNull();
  expect(
    screen.queryByText("Requisitos, entrega esperada e critérios de aceite."),
  ).toBeNull();
  const autonomy = screen.getByRole("combobox", {
    name: "Configuração individual",
  });
  const panel = document.querySelector(".task-detail-reading");
  await userEvent.click(screen.getByRole("tab", { name: "Subtasks" }));
  expect(screen.queryByText(/Filhos diretos em todos os boards/)).toBeNull();
  await userEvent.click(screen.getByRole("tab", { name: "Visão geral" }));
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
  expect(document.querySelector(".task-detail-reading")).toBe(panel);
  expect(panel).toHaveAttribute("data-task-section", "overview");
  await userEvent.click(screen.getByRole("tab", { name: "Planos" }));
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Planos" })).toHaveAttribute(
      "aria-selected",
      "true",
    ),
  );
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
      <TaskDescription task={task} />
      <TaskCurrentSummary task={task} />
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
  expect(within(screen.getByRole("region", { name: "Conteúdo do resumo" })).getByText(/Pontos de entrada inventariados/)).toBeVisible();
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
