import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { TaskExecutionTimeline } from "./task-execution-tracking";
import { event, executionPage } from "./execution-fixtures";

it("uses the unified Event ID, not the tracking or summary ID, and closes the compact popover without a modal", async () => {
  window.history.replaceState({}, "", "/tasks/example?tab=timeline");
  const api = createMockApi({ delay: 0 });
  const row = {
    ...makeSeed().timeline[0],
    id: "019a0000-0000-7000-8000-000000000077",
    taskId: "task",
    type: "execution.recorded",
    data: { executionSummaryId: event.summaryId },
  };
  const list = vi
    .spyOn(api, "list")
    .mockResolvedValue(executionPage([row]) as never);
  const tracking = vi
    .spyOn(api, "executionTrackingEvents")
    .mockResolvedValue(executionPage([event]));
  render(
    <ApiProvider api={api}>
      <TaskExecutionTimeline taskId="task" version={1} />
    </ApiProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", {
      name: /Resumo de execução registrado:/,
    }),
  );
  expect(await screen.findByText(/Em revisão histórica/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Fechar detalhes do ponto" }),
  ).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Ver evento" }));
  expect(new URLSearchParams(location.search).get("timeline.selected")).toBe(
    row.id,
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(list).toHaveBeenCalledTimes(1);
  expect(tracking).toHaveBeenCalledWith(
    "task",
    { summaryId: event.summaryId, offset: 0, limit: 1 },
    expect.any(AbortSignal),
  );
});
