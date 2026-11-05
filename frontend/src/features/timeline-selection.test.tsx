import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { TaskExecutionTimeline } from "./task-execution-tracking";
import { event, executionPage } from "./execution-fixtures";

it("retains earlier points when loading the next page of mixed timeline events", async () => {
  window.history.replaceState({}, "", "/tasks/example?tab=timeline");
  const api = createMockApi({ delay: 0 });
  const rows = Array.from({ length: 21 }, (_, index) => ({
    ...makeSeed().timeline[0],
    id: `page-event-${index}`,
    sequence: index,
    taskId: "task",
    data: {},
    type: index === 0 ? "execution.recorded" : "comment.created",
  }));
  vi.spyOn(api, "timelinePoints").mockImplementation(async (_taskId, query) => {
    const offset = Number(query?.offset ?? 0);
    return {
      items: rows.slice(offset, offset + 20),
      total: 21,
      offset,
      limit: 20,
      hasMore: offset === 0,
      nextOffset: offset === 0 ? 20 : null,
    } as never;
  });
  const fullEvents = vi.spyOn(api, "list");
  const { container } = render(
    <ApiProvider api={api}>
      <TaskExecutionTimeline taskId="task" version={3} />
    </ApiProvider>,
  );
  await waitFor(() =>
    expect(
      container.querySelectorAll(".execution-timeline-point"),
    ).toHaveLength(21),
  );
  expect(
    screen.getByRole("button", { name: /Resumo de execução registrado:/ }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Histórico parcial/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
  expect(fullEvents).not.toHaveBeenCalled();
});

it("preserves all timeline event types and keeps the chart independent of selected event", async () => {
  window.history.replaceState(
    {},
    "",
    "/tasks/example?tab=timeline&timeline.selected=comment",
  );
  const api = createMockApi({ delay: 0 });
  const rows = [
    "comment.created",
    "plan.revised",
    "task.updated",
    "execution.recorded",
    "task.parent_changed",
  ].map((type, index) => ({
    ...makeSeed().timeline[0],
    id: `event-${index}`,
    sequence: index,
    type,
    data: {},
    taskId: "task",
  }));
  const list = vi.spyOn(api, "timelinePoints").mockImplementation(async () => {
    return executionPage(rows) as never;
  });
  const { container } = render(
    <ApiProvider api={api}>
      <TaskExecutionTimeline taskId="task" version={2} />
    </ApiProvider>,
  );
  await waitFor(() =>
    expect(
      container.querySelectorAll(".execution-timeline-point"),
    ).toHaveLength(5),
  );
  expect(
    screen.getByRole("button", { name: /Vínculo da tarefa alterado:/ }),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: /Comentário registrado:/ }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Ver evento" }));
  expect(new URLSearchParams(location.search).get("timeline.selected")).toBe(
    "event-0",
  );
  expect(container.querySelectorAll(".execution-timeline-point")).toHaveLength(
    5,
  );
  expect(list).toHaveBeenCalledTimes(1);
});

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
  vi.spyOn(api, "timelinePoints").mockResolvedValue(
    executionPage([row]) as never,
  );
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
  expect(list).toHaveBeenCalledWith(
    "timeline",
    "task",
    { id: row.id, offset: 0, limit: 1 },
    expect.any(AbortSignal),
  );
  expect(tracking).toHaveBeenCalledWith(
    "task",
    { summaryId: event.summaryId, offset: 0, limit: 1 },
    expect.any(AbortSignal),
  );
});
