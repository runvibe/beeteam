import { render, screen, within, waitFor } from "@testing-library/react";
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
  expect(
    screen.getByRole("img", {
      name: /Evolução do progresso registrado: 0 registros/,
    }),
  ).toBeVisible();
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

it("keeps empty distribution tracks without invented status or executor bars", () => {
  const { container } = render(
    <SubtaskCharts
      data={{
        total: 0,
        done: 0,
        remaining: 0,
        blocked: 0,
        archivedIncluded: true,
        byStatus: [],
        byExecutor: [],
      }}
      onFilter={vi.fn()}
    />,
  );
  expect(container.querySelectorAll(".overview-empty-track")).toHaveLength(2);
  expect(container.querySelectorAll(".overview-empty-track > *")).toHaveLength(
    0,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("reveals recorded progress and actor without associating tokens by time", async () => {
  const data: TaskOverviewData["progressHistory"] = {
    items: [
      {
        eventId: "first",
        occurredAt: "2026-11-02T10:00:00Z",
        percent: 0,
        note: "",
        source: "task.updated",
        actorKind: "human",
        actorId: null,
      },
      {
        eventId: "second",
        occurredAt: "2026-11-02T10:01:00Z",
        percent: 50,
        note: "",
        source: "task.updated",
        actorKind: "human",
        actorId: null,
      },
    ],
    total: 3,
    limit: 100,
    truncated: false,
    coverage: "explicit_progress_events_only",
  };
  data.items.push({
    ...data.items[1],
    eventId: "last",
    occurredAt: "2026-11-02T11:00:00Z",
    percent: 90,
  });
  const { container } = render(<ProgressHistory data={data} />);
  const buttons = screen.getAllByRole("button");
  expect(Number.parseFloat(buttons[1].style.width)).toBeLessThan(44);
  await userEvent.tab();
  expect(buttons[0]).toHaveFocus();
  expect(
    within(screen.getByRole("dialog")).getByText("Progresso registrado: 0%"),
  ).toBeVisible();
  await userEvent.click(buttons[1]);
  expect(
    within(screen.getByRole("dialog")).getByText("Progresso registrado: 50%"),
  ).toBeVisible();
  expect(
    within(screen.getByRole("dialog")).getByText(
      /Pessoa · identidade não informada/,
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("dialog")).getByText(
      /Tokens neste ponto: não informados/,
    ),
  ).toBeVisible();
  const popup = screen.getByRole("dialog", {
    name: "Detalhes do progresso neste ponto",
  });
  expect(
    within(popup).getByText(/Status no momento do registro: não registrado/),
  ).toBeVisible();
  expect(popup.querySelector("time")).toHaveAttribute(
    "datetime",
    data.items[1].occurredAt,
  );
  expect(
    container.querySelector(".overview-progress-plot")?.contains(popup),
  ).toBe(false);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.hover(buttons[0]);
  expect(await screen.findByRole("dialog")).toBeVisible();
  await userEvent.unhover(buttons[0]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await userEvent.pointer([
    { keys: "[TouchA>]", target: buttons[1] },
    { keys: "[/TouchA]", target: buttons[1] },
  ]);
  expect(await screen.findByRole("dialog")).toBeVisible();
  await userEvent.click(
    screen.getByRole("heading", { name: "Evolução do progresso registrado" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    Array.from(container.querySelectorAll("svg g text")).map(
      (el) => el.textContent,
    ),
  ).toEqual(["0", "50", "100"]);
});
