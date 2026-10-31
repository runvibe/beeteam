import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SubtaskCharts, ProgressHistory } from "./task-overview-charts";
import type { TaskOverviewData } from "@/api/task-overview";

it("keeps blocked as an overlapping dimension and passes actual status filters", async () => {
  const onFilter = vi.fn();
  const children: TaskOverviewData["directSubtasks"] = {
    archivedIncluded: true,
    total: 3,
    done: 1,
    remaining: 2,
    blocked: 1,
    byStatus: [
      {
        boardId: "b",
        boardName: "Board",
        statusId: "s1",
        statusName: "Em andamento",
        isDone: false,
        total: 2,
        blocked: 1,
        color: null,
      },
      {
        boardId: "b",
        boardName: "Board",
        statusId: "s2",
        statusName: "Concluído",
        isDone: true,
        total: 1,
        blocked: 0,
        color: null,
      },
    ],
    byExecutor: [
      {
        executorAgentId: "a",
        agentName: "Eva",
        total: 3,
        done: 1,
        remaining: 2,
      },
    ],
  };
  render(<SubtaskCharts data={children} onFilter={onFilter} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Em andamento: 2 subtarefas" }),
  );
  expect(onFilter).toHaveBeenCalledWith({ statusId: "s1" });
  await userEvent.click(screen.getByRole("button", { name: "1 bloqueada" }));
  expect(onFilter).toHaveBeenCalledWith({ blocked: true });
  expect(screen.getByText(/Bloqueadas já estão incluídas/)).toBeVisible();
});
it("does not invent progress points and gives the recorded values a text alternative", () => {
  const { rerender } = render(
    <ProgressHistory
      data={{
        items: [],
        total: 0,
        limit: 100,
        truncated: false,
        coverage: "explicit_progress_events_only",
      }}
    />,
  );
  expect(screen.queryByRole("img")).toBeNull();
  rerender(
    <ProgressHistory
      data={{
        items: [
          {
            eventId: "e",
            occurredAt: "2026-10-30T12:00:00Z",
            percent: 40,
            note: "Registrado",
            source: "task.updated",
            actorKind: "human",
            actorId: null,
          },
        ],
        total: 1,
        limit: 100,
        truncated: false,
        coverage: "explicit_progress_events_only",
      }}
    />,
  );
  expect(
    screen.getByRole("img", { name: /Evolução do progresso registrado/ }),
  ).toBeVisible();
  expect(
    screen.getByRole("cell", { name: "40%", hidden: true }),
  ).toBeInTheDocument();
});
