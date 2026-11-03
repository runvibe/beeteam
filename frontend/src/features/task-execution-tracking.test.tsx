import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { TaskExecutionTracking } from "./task-execution-tracking";
import {
  intervalUsage,
  interval,
  event,
  executionPage,
} from "./execution-fixtures";
it("keeps global totals independent of loaded intervals and shows explicit lifecycle metadata", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "executionIntervalUsage").mockResolvedValue(intervalUsage);
  vi.spyOn(api, "executionIntervals")
    .mockResolvedValueOnce(executionPage([interval], 2, 20))
    .mockRejectedValueOnce(new Error("Página temporariamente indisponível"))
    .mockResolvedValueOnce(
      executionPage(
        [
          {
            ...interval,
            id: "second",
            state: "open",
            totalTokens: null,
            partialTokens: "200",
            endObservedAt: null,
            endSummaryId: null,
          },
        ],
        2,
      ),
    );
  vi.spyOn(api, "executionTrackingEvents").mockResolvedValue(
    executionPage([event]),
  );
  render(
    <ApiProvider api={api}>
      <TaskExecutionTracking taskId="task" version={1} />
    </ApiProvider>,
  );
  expect(await screen.findByText("9.007.199.254.740.993")).toBeVisible();
  expect(
    await screen.findByText(
      "Status no momento do resumo: Em revisão histórica",
    ),
  ).toBeVisible();
  expect(screen.getAllByText(/model-A · model-B/).length).toBeGreaterThan(0);
  expect(screen.getByText("Troca de tarefa")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Carregar mais intervalos" }),
  );
  expect(screen.getByText("9.007.199.254.740.993")).toBeVisible();
  expect(
    await screen.findByText(/Página temporariamente indisponível/),
  ).toBeVisible();
  expect(screen.getByText("1 de 2 intervalos")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Tentar novamente" }),
  );
  expect(await screen.findByText("2 de 2 intervalos")).toBeVisible();
});
it("keeps missing tracking and loading failures distinct from measured zero", async () => {
  const api = createMockApi({ delay: 0 });
  render(
    <ApiProvider api={api}>
      <TaskExecutionTracking taskId="task" version={1} />
    </ApiProvider>,
  );
  expect(
    await screen.findByText(/Intervalos disponíveis apenas na API conectada/),
  ).toBeVisible();
  expect(screen.queryByText("0")).toBeNull();
  expect(screen.getByText("Histórico de execução indisponível.")).toBeVisible();
});
