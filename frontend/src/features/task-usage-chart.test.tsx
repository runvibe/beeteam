import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import type { SummaryUsageTimelineItem } from "@/api/generated/kanban/SummaryUsageTimelineItem";
import { UsageCheckpointChart } from "./task-usage-chart";
function point(
  id: string,
  hour: number,
  value: string | null,
): SummaryUsageTimelineItem {
  return {
    summaryId: id,
    reportedAt: `2026-11-02T${hour}:00:00Z`,
    reportingActor: { actorKind: "human", actorId: null },
    statusObserved: { id: "status", name: "Em andamento", isDone: false },
    usageReport: null,
    recordedSessionUsage: {
      measuredTotalTokens: value,
      estimatedTotalTokens: null,
      coverage: {
        sessions: 1,
        baselineEntries: value === null ? 1 : 0,
        deltaEntries: value === null ? 0 : 1,
        duplicateEntries: 0,
      },
    },
  };
}
it("keeps baseline informational, breaks lines at gaps and selects checkpoints by keyboard and touch", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <UsageCheckpointChart
        taskId="task"
        items={[
          point("a", 10, null),
          point("b", 11, "0"),
          point("c", 12, "1186039"),
          point("d", 13, null),
          point("e", 14, "340282366920938463463374607431768211455"),
        ]}
      />
    </ApiProvider>,
  );
  expect(container.querySelectorAll(".overview-progress-line")).toHaveLength(1);
  const points = screen.getAllByRole("button", { name: /^Resumo / });
  expect(points).toHaveLength(5);
  expect(points[0]).toHaveAttribute("data-missing", "true");
  expect(points[1]).toHaveAttribute("data-missing", "false");
  await user.tab();
  expect(points[0]).toHaveFocus();
  expect(screen.getByText(/Referência inicial presente/)).toBeVisible();
  await user.click(points[2]);
  expect(points[2]).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Delta medido: 1.186.039/)).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Checkpoint"), "e");
  expect(
    screen.getByText(
      /Delta medido: 340.282.366.920.938.463.463.374.607.431.768.211.455/,
    ),
  ).toBeVisible();
});
it("opens the selected immutable summary through paginated read-only API and preserves errors for retry", async () => {
  const user = userEvent.setup();
  const api = createMockApi({ delay: 0 });
  const row = {
    ...makeSeed().summaries[0],
    id: "target",
    summary: "Resumo solicitado",
  };
  const list = vi
    .spyOn(api, "list")
    .mockRejectedValueOnce(new Error("Falha temporária"))
    .mockResolvedValueOnce({
      items: [{ ...row, id: "other" }],
      offset: 0,
      limit: 100,
      total: 2,
      hasMore: true,
      nextOffset: 100,
    })
    .mockResolvedValueOnce({
      items: [row],
      offset: 100,
      limit: 100,
      total: 2,
      hasMore: false,
      nextOffset: null,
    });
  render(
    <ApiProvider api={api}>
      <UsageCheckpointChart taskId="task" items={[point("target", 10, "12")]} />
    </ApiProvider>,
  );
  expect(list).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Abrir resumo" }));
  await screen.findByText(/Falha temporária/);
  await user.click(screen.getByRole("button", { name: /Tentar novamente/ }));
  expect(
    await within(
      screen.getByRole("region", { name: "Resumo selecionado" }),
    ).findByText("Resumo solicitado"),
  ).toBeVisible();
  expect(list).toHaveBeenLastCalledWith(
    "summaries",
    "task",
    expect.objectContaining({
      createdFrom: "2026-11-02T10:00:00Z",
      offset: 100,
      sortOrder: "asc",
    }),
    expect.any(AbortSignal),
  );
});

it("keeps the empty plot and axes without fabricated points or controls", () => {
  const { container } = render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <UsageCheckpointChart taskId="task" items={[]} />
    </ApiProvider>,
  );
  expect(
    screen.getByRole("heading", { name: "Evolução dos resumos" }),
  ).toBeVisible();
  expect(screen.getByText("Sem resumos disponíveis")).toBeVisible();
  expect(container.querySelector(".usage-chart-plot svg")).toHaveAttribute(
    "viewBox",
    "0 0 480 270",
  );
  expect(container.querySelectorAll(".overview-gridline")).toHaveLength(2);
  expect(
    container.querySelectorAll(".usage-chart-point, .overview-progress-line"),
  ).toHaveLength(0);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Abrir resumo" }),
  ).not.toBeInTheDocument();
});
it("retains baseline-only checkpoints as informational points without zero or a line", () => {
  const { container } = render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <UsageCheckpointChart
        taskId="task"
        items={[point("baseline", 10, null)]}
      />
    </ApiProvider>,
  );
  expect(container.querySelector(".usage-chart-plot svg")).toHaveAttribute(
    "viewBox",
    "0 0 480 270",
  );
  expect(
    screen.getByRole("button", { name: /sem delta medido/ }),
  ).toHaveAttribute("data-missing", "true");
  expect(container.querySelectorAll(".overview-progress-line")).toHaveLength(0);
  expect(screen.getByText(/Referência inicial presente/)).toBeVisible();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});

it("uses each summary historical status independently of its token delta", async () => {
  const first = point("first", 10, "100");
  first.statusObserved = { id: "old", name: "Em andamento", isDone: false };
  const second = point("second", 11, "100");
  second.statusObserved = { id: "new", name: "Em teste", isDone: false };
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <UsageCheckpointChart taskId="task" items={[first, second]} />
    </ApiProvider>,
  );
  expect(
    screen.getByText("Status no momento do resumo: Em teste"),
  ).toBeVisible();
  await userEvent.selectOptions(screen.getByLabelText("Checkpoint"), "first");
  expect(
    screen.getByText("Status no momento do resumo: Em andamento"),
  ).toBeVisible();
  expect(screen.getByText(/Delta medido: 100/)).toBeVisible();
  expect(
    screen.getByText(/não progresso nem valor numérico de status/),
  ).toBeVisible();
});
