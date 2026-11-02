import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { UsageCheckpointPoint } from "./usage-checkpoint-point";
import type { SummaryUsageTimelineItem } from "@/api/generated/kanban/SummaryUsageTimelineItem";
const point: SummaryUsageTimelineItem = {
  summaryId: "summary",
  reportedAt: "2026-11-02T10:00:00Z",
  reportingActor: { actorKind: "agent", actorId: makeSeed().agents[0].id },
  statusObserved: { id: "status", name: "Em teste", isDone: false },
  usageReport: null,
  recordedSessionUsage: {
    measuredTotalTokens: "1186039",
    estimatedTotalTokens: null,
    coverage: {
      sessions: 1,
      baselineEntries: 0,
      deltaEntries: 1,
      duplicateEntries: 0,
    },
  },
};
function setup() {
  return render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <div data-testid="plot" style={{ overflow: "hidden" }}>
        <UsageCheckpointPoint
          point={point}
          position={{ x: 40, y: 80 }}
          selected={false}
          detailId="detail"
          onSelect={() => {}}
        />
      </div>
      <button>Fora do gráfico</button>
    </ApiProvider>,
  );
}
it("opens a portal anchored to the hovered point with real author/status/date/tokens and closes on exit or Escape", async () => {
  const user = userEvent.setup();
  setup();
  const trigger = screen.getByRole("button", { name: /Resumo / });
  await user.hover(trigger);
  const popup = await screen.findByRole("dialog", {
    name: "Detalhes do resumo neste ponto",
  });
  expect(within(screen.getByTestId("plot")).queryByRole("dialog")).toBeNull();
  expect(
    await within(popup).findByText(makeSeed().agents[0].name),
  ).toBeVisible();
  expect(
    within(popup).getByText("Status no momento do resumo: Em teste"),
  ).toBeVisible();
  expect(
    within(popup).getByText("Delta medido de sessão: 1.186.039 tokens"),
  ).toBeVisible();
  expect(
    within(popup).getByText("Estimado de sessão: Não informado tokens"),
  ).toBeVisible();
  expect(popup.querySelector("time")).toHaveAttribute(
    "datetime",
    point.reportedAt,
  );
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.unhover(trigger);
  await user.hover(trigger);
  expect(await screen.findByRole("dialog")).toBeVisible();
  await user.unhover(trigger);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("opens on keyboard focus and touch, dismisses outside and keeps unknown data explicit", async () => {
  const user = userEvent.setup();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <UsageCheckpointPoint
        point={{
          ...point,
          reportingActor: { actorKind: "human", actorId: null },
          statusObserved: null,
          recordedSessionUsage: undefined,
        }}
        position={{ x: 40, y: 80 }}
        selected={false}
        detailId="detail"
        onSelect={() => {}}
      />
      <button>Fora do gráfico</button>
    </ApiProvider>,
  );
  await user.tab();
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(
    screen.getByText("Status no momento do resumo: Não registrado"),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  const trigger = screen.getByRole("button", { name: /Resumo / });
  await user.pointer([
    { keys: "[TouchA>]", target: trigger },
    { keys: "[/TouchA]", target: trigger },
  ]);
  expect(await screen.findByRole("dialog")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Fora do gráfico" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

function report(): SummaryUsageReport {
  return {
    reportedAt: "2026-10-31T01:00:00Z",
    reportingActor: { actorKind: "human", actorId: null },
    statusObserved: { id: "status", name: "Em andamento", isDone: false },
    revision: 1,
    entries: [
      {
        id: "entry",
        reportedAt: "2026-10-31T01:00:00Z",
        reportingActor: { actorKind: "human", actorId: null },
        reportRevision: 1,
        evidenceKey: "evidence",
        canonicalSummaryId: "summary",
        delta: null,
        counted: false,
        coverageReason: "baseline_or_unavailable",
        observation: {
          source: "Source",
          harness: "Harness A",
          surface: "Desktop",
          harnessVersion: null,
          sessionId: "session",
          epoch: "epoch",
          evidenceId: "evidence",
          previousEvidenceId: null,
          actor: { kind: "human", id: null },
          actorRole: "human",
          provider: "Provider",
          modelId: "Model A",
          scope: "session",
          reportKind: "cumulative_snapshot",
          quality: "measured",
          attribution: "exact",
          observedAt: "2026-10-31T00:00:00Z",
          periodStart: null,
          periodEnd: null,
          inputTokens: "999999",
          outputTokens: "0",
          cachedInputTokens: null,
          reasoningOutputTokens: null,
          discovery: null,
        },
      },
    ],
  };
}
it("shows a session baseline snapshot without fabricating a delta or double-counting cached/reasoning tokens", async () => {
  const baseline = report();
  Object.assign(baseline.entries[0].observation, {
    inputTokens: "30732075",
    outputTokens: "106883",
    cachedInputTokens: "30407552",
    reasoningOutputTokens: "21969",
    attribution: "shared",
  });
  const { rerender } = render(
    <UsageCheckpointPoint
      point={{
        ...point,
        reportingActor: { actorKind: "human", actorId: null },
        recordedSessionUsage: undefined,
        usageReport: baseline,
      }}
      position={{ x: 40, y: 80 }}
      selected={false}
      detailId="baseline"
      onSelect={() => {}}
    />,
  );
  await userEvent.hover(screen.getByRole("button", { name: /Resumo / }));
  const popup = screen.getByRole("dialog");
  expect(
    within(popup).getByText(
      "Acumulado registrado de sessão (medido): 30.838.958 tokens",
    ),
  ).toBeVisible();
  expect(
    within(popup).getByText(
      /Não atribuído à tarefa nem somado ao total ou ao delta/,
    ),
  ).toBeVisible();
  expect(
    within(popup).getByText("Delta medido de sessão: Não informado tokens"),
  ).toBeVisible();
  baseline.entries[0].observation.outputTokens = null;
  rerender(
    <UsageCheckpointPoint
      point={{
        ...point,
        reportingActor: { actorKind: "human", actorId: null },
        usageReport: baseline,
      }}
      position={{ x: 40, y: 80 }}
      selected={false}
      detailId="baseline"
      onSelect={() => {}}
    />,
  );
  expect(
    within(popup).getByText(
      "Acumulado registrado de sessão (medido): Não informado tokens",
    ),
  ).toBeVisible();
  baseline.entries[0].observation.scope = "session_tree";
  rerender(
    <UsageCheckpointPoint
      point={{
        ...point,
        reportingActor: { actorKind: "human", actorId: null },
        usageReport: baseline,
      }}
      position={{ x: 40, y: 80 }}
      selected={false}
      detailId="baseline"
      onSelect={() => {}}
    />,
  );
  expect(within(popup).queryByText(/Acumulado registrado/)).toBeNull();
});
