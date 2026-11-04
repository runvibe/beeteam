import { setLocalePreference } from "@/i18n";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import type { TaskUsage } from "@/api/generated/kanban/TaskUsage";
import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";
import { SummaryUsage, tokenCount } from "./summary-usage";
import { TaskUsagePanel } from "./task-usage";
const emptyTokens = {
  inputTokens: null,
  outputTokens: null,
  cachedInputTokens: null,
  reasoningOutputTokens: null,
  totalTokens: null,
};
const actor = { actorKind: "human", actorId: null } as const;
const page = <T,>(items: T[]) => ({
  items,
  total: items.length,
  offset: 0,
  limit: 20,
  truncated: false,
});
function usage(): TaskUsage {
  return {
    knownTotalTokens: "9007199254740993",
    estimatedTotalTokens: "12",
    measuredComponents: { ...emptyTokens, inputTokens: "0" },
    coverage: {
      totalSummaries: 2,
      reportedSummaries: 1,
      missingSummaries: 1,
      entries: 2,
      measuredEntries: 1,
      estimatedEntries: 1,
      unavailableEntries: 0,
      baselineEntries: 1,
      duplicateEntries: 0,
      unallocatedEntries: 0,
    },
    models: page([{ provider: "Provider", modelId: "Model A", harness: null }]),
    harnesses: page([{ provider: null, modelId: null, harness: "Harness A" }]),
    timeline: page([
      {
        summaryId: "summary",
        reportedAt: "2026-10-31T01:00:00Z",
        reportingActor: actor,
        statusObserved: null,
        usageReport: null,
      },
    ]),
  };
}
function report(): SummaryUsageReport {
  return {
    reportedAt: "2026-10-31T01:00:00Z",
    reportingActor: actor,
    statusObserved: { id: "status", name: "Em andamento", isDone: false },
    revision: 1,
    entries: [
      {
        id: "entry",
        reportedAt: "2026-10-31T01:00:00Z",
        reportingActor: actor,
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
it("preserves precision and distinguishes null from genuine zero", () => {
  expect(tokenCount(null)).toBe("Não informado");
  expect(tokenCount("0")).toBe("0");
  expect(tokenCount("9007199254740993")).toBe("9.007.199.254.740.993");
});
it("accepts legacy summaries without fabricated usage", () => {
  render(<SummaryUsage />);
  expect(screen.getByText(/Ausência não significa zero/)).toBeVisible();
});
it("separates original snapshot from derived delta and safe provenance", async () => {
  const r = report();
  r.entries[0].observation.source = "<script>unsafe</script>";
  const { container } = render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <SummaryUsage report={r} />
    </ApiProvider>,
  );
  expect(screen.getByText(/Não incluído no total/)).toHaveTextContent(
    "Não informado",
  );
  await userEvent.click(screen.getByText("Observação original e proveniência"));
  expect(screen.getByText("999.999")).toBeVisible();
  expect(screen.getByText("0")).toBeVisible();
  expect(screen.getByText("<script>unsafe</script>")).toBeVisible();
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getAllByText(/Snapshot acumulado/)).toHaveLength(2);
});
it("shows authoritative totals, mixed coverage and legacy checkpoint time without summing snapshots", async () => {
  const data = usage();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <TaskUsagePanel taskId="task" usage={data} version={1} />
    </ApiProvider>,
  );
  expect(screen.getByText("9.007.199.254.740.993")).toBeVisible();
  expect(screen.getByText("12")).toBeVisible();
  expect(screen.getByText(/Qualidade mista/)).toBeVisible();
  await userEvent.click(screen.getByText("Checkpoints dos resumos (1)"));
  expect(
    screen.getAllByText(/Status observado: Não registrado/).some((el) => !!el),
  ).toBe(true);
  expect(
    screen.getAllByText(/Ausência não significa zero/).length,
  ).toBeGreaterThan(0);
  expect(screen.getByText(/Não representa horário de consumo/)).toBeVisible();
});
it("paginates dimensions and checkpoints from API while keeping total independent", async () => {
  const data = usage();
  data.recordedSessionUsage = {
    measuredTotalTokens: "1186039",
    estimatedTotalTokens: null,
    coverage: {
      sessions: 1,
      baselineEntries: 1,
      deltaEntries: 1,
      duplicateEntries: 0,
    },
  };
  data.models = { ...data.models, total: 2, limit: 1, truncated: true };
  data.timeline = { ...data.timeline, total: 2, limit: 1, truncated: true };
  const api = createMockApi({ delay: 0 });
  const dims = vi.spyOn(api, "usageDimensions").mockResolvedValue({
    ...page([{ provider: "Other", modelId: "Model B", harness: null }]),
    offset: 1,
    total: 2,
  });
  const next = usage();
  next.knownTotalTokens = "7";
  next.recordedSessionUsage = {
    measuredTotalTokens: "999",
    estimatedTotalTokens: null,
    coverage: {
      sessions: 1,
      baselineEntries: 1,
      deltaEntries: 1,
      duplicateEntries: 0,
    },
  };
  next.timeline = {
    ...page([{ ...data.timeline.items[0], summaryId: "second" }]),
    offset: 1,
    total: 2,
  };
  const checkpoints = vi.spyOn(api, "usage").mockResolvedValue(next);
  render(
    <ApiProvider api={api}>
      <TaskUsagePanel taskId="task" usage={data} version={1} />
    </ApiProvider>,
  );
  await userEvent.click(screen.getByText("Modelos registrados (2)"));
  await userEvent.click(
    screen.getByRole("button", { name: "Carregar mais modelos" }),
  );
  await screen.findByText("Model B · Other");
  expect(dims).toHaveBeenCalledWith(
    "task",
    "model",
    { offset: 1, limit: 100 },
    expect.any(AbortSignal),
  );
  await userEvent.click(screen.getByText("Checkpoints dos resumos (2)"));
  await userEvent.click(
    screen.getByRole("button", { name: "Carregar mais checkpoints" }),
  );
  await waitFor(() =>
    expect(screen.getByText("2 de 2 checkpoints")).toBeVisible(),
  );
  expect(screen.getByText("1.186.039")).toBeVisible();
  expect(screen.queryByText("999")).not.toBeInTheDocument();
  expect(checkpoints).toHaveBeenCalledWith(
    "task",
    { offset: 1, limit: 20 },
    expect.any(AbortSignal),
  );
  expect(screen.getByText("9.007.199.254.740.993")).toBeVisible();
});
it("keeps previous dimensions after a failed next page and allows retry", async () => {
  const data = usage();
  data.harnesses = { ...data.harnesses, total: 2, limit: 1, truncated: true };
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "usageDimensions").mockRejectedValue(
    new Error("Falha temporária"),
  );
  render(
    <ApiProvider api={api}>
      <TaskUsagePanel taskId="task" usage={data} version={1} />
    </ApiProvider>,
  );
  await userEvent.click(screen.getByText("Harnesses registrados (2)"));
  await userEvent.click(
    screen.getByRole("button", { name: "Carregar mais harnesses" }),
  );
  await screen.findByText(/Falha temporária/);
  expect(screen.getByText("Harness A")).toBeVisible();
});

it("provides a focusable native disclosure for unavailable collection attempts", async () => {
  const r = report();
  const o = r.entries[0].observation;
  o.quality = "unavailable";
  o.reportKind = "unavailable";
  o.inputTokens = null;
  o.outputTokens = null;
  o.discovery = {
    reason: "Fonte sem contadores",
    attempts: ["Consultado relatório de sessão"],
  };
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <SummaryUsage report={r} />
    </ApiProvider>,
  );
  const disclosure = screen.getByText("Observação original e proveniência");
  disclosure.focus();
  expect(disclosure).toHaveFocus();
  await userEvent.click(disclosure);
  expect(screen.getByText("Fonte sem contadores")).toBeVisible();
  expect(screen.getByText("Consultado relatório de sessão")).toBeVisible();
});

it("shows recorded session deltas independently from unallocated task totals and unknown models", async () => {
  const data = usage();
  data.knownTotalTokens = null;
  data.estimatedTotalTokens = null;
  data.recordedSessionUsage = {
    measuredTotalTokens: "1186039",
    estimatedTotalTokens: null,
    coverage: {
      sessions: 1,
      baselineEntries: 1,
      deltaEntries: 1,
      duplicateEntries: 0,
    },
  };
  data.models = page([{ provider: null, modelId: null, harness: null }]);
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <TaskUsagePanel taskId="task" usage={data} version={1} />
    </ApiProvider>,
  );
  const session = screen.getByRole("region", {
    name: "Consumo registrado de sessão",
  });
  expect(within(session).getByText("1.186.039")).toBeVisible();
  expect(
    within(session).getByText(/não representam consumo exato atribuído/),
  ).toBeVisible();
  expect(
    screen.getByText("Total acumulado conhecido (tokens)").parentElement,
  ).toHaveTextContent("Não informado");
  await userEvent.click(screen.getByText("Modelos registrados (1)"));
  expect(
    screen.getByText("Modelo não informado · Provedor não informado"),
  ).toBeVisible();
});
it("does not derive a session aggregate from legacy checkpoints", () => {
  const data = usage();
  data.timeline.items[0].usageReport = report();
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <TaskUsagePanel taskId="task" usage={data} version={1} />
    </ApiProvider>,
  );
  expect(
    screen.queryByRole("region", { name: "Consumo registrado de sessão" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("9.007.199.254.740.993")).toBeVisible();
});

it.each([undefined, { ...usage(), timeline: page([]) }])(
  "keeps the chart area when usage or checkpoints are absent",
  (data) => {
    const { container } = render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <TaskUsagePanel taskId="task" version={1} usage={data} />
      </ApiProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Evolução dos resumos" }),
    ).toBeVisible();
    expect(
      container.querySelector(".usage-chart-plot svg"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sem resumos disponíveis")).toBeVisible();
  },
);

it.each(["en", "pt"] as const)(
  "formats four-digit coverage-detail aggregates in %s",
  async (language) => {
    setLocalePreference(language);
    const data = usage();
    data.coverage.entries = 1234;
    render(
      <ApiProvider api={createMockApi({ delay: 0 })}>
        <TaskUsagePanel taskId="task" usage={data} version={1} />
      </ApiProvider>,
    );
    await userEvent.click(
      screen.getByText(
        language === "en" ? "Coverage and gaps" : "Cobertura e lacunas",
      ),
    );
    const label = screen.getByText(language === "en" ? "Entries" : "Entradas", {
      selector: "dt",
    });
    expect(label.parentElement?.querySelector("dd")).toHaveTextContent(
      language === "en" ? "1,234" : "1.234",
    );
  },
);
