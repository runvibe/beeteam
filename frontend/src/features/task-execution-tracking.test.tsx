import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { TaskExecutionTracking } from "./task-execution-tracking";
import { intervalUsage } from "./execution-fixtures";
it("keeps interval totals without loading verbose histories in the dashboard", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "executionIntervalUsage").mockResolvedValue(intervalUsage);
  const intervals = vi.spyOn(api, "executionIntervals");
  const events = vi.spyOn(api, "executionTrackingEvents");
  render(
    <ApiProvider api={api}>
      <TaskExecutionTracking taskId="task" version={1} />
    </ApiProvider>,
  );
  expect(await screen.findByText("9.007.199.254.740.993")).toBeVisible();
  expect(intervals).not.toHaveBeenCalled();
  expect(events).not.toHaveBeenCalled();
  expect(screen.queryByText("Intervalos registrados")).toBeNull();
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
  expect(screen.queryByText("Histórico de execução indisponível.")).toBeNull();
});
