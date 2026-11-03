import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createHttpApi } from "@/api/http";
import { ProgressHistory } from "./task-overview-charts";
import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";

function setup(summaryId?: string, summary: object = {}) {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [{ id: "exact-summary", taskId: "task", ...summary }],
        total: 1,
        offset: 0,
        limit: 1,
        hasMore: false,
        nextOffset: null,
      }),
    ),
  );
  render(
    <ApiProvider api={createHttpApi({ fetch: fetcher })}>
      <ProgressHistory
        taskId="task"
        data={{
          items: [
            {
              eventId: "event",
              occurredAt: "2026-11-03T12:00:00Z",
              percent: 90,
              note: "",
              source: "task.updated",
              actorKind: "human",
              actorId: null,
              summaryId,
            },
          ],
          total: 1,
          limit: 100,
          truncated: false,
          coverage: "explicit_progress_events_only",
        }}
      />
    </ApiProvider>,
  );
  return fetcher;
}

it("loads the exact linked summary only when opened and displays its historical status", async () => {
  const fetcher = setup("exact-summary", {
    statusObserved: { id: "review", name: "Em revisão", isDone: false },
  });
  expect(fetcher).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: /: 90%$/ }));
  expect(
    await screen.findByText("Status no momento do registro: Em revisão"),
  ).toBeVisible();
  expect(fetcher.mock.calls[0][0]).toBe(
    "/api/v1/tasks/task/execution-summaries?id=exact-summary&limit=1",
  );
  expect(
    screen.getByText(/Métricas não informadas neste resumo/),
  ).toBeVisible();
});

it("keeps standalone legacy progress unknown without querying nearby summaries", async () => {
  const fetcher = setup();
  await userEvent.click(screen.getByRole("button", { name: /: 90%$/ }));
  expect(
    screen.getByText("Status no momento do registro: não registrado."),
  ).toBeVisible();
  expect(screen.getByText("Tokens neste ponto: não informados.")).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
});

it("shows measured cumulative evidence separately from its delta without adding cache or reasoning", async () => {
  const report: SummaryUsageReport = {
    revision: 1,
    reportedAt: "2026-11-03T12:00:00Z",
    reportingActor: { actorKind: "human", actorId: null },
    statusObserved: { id: "review", name: "Em revisão", isDone: false },
    entries: [
      {
        id: "entry",
        canonicalSummaryId: "exact-summary",
        counted: false,
        coverageReason: "shared_or_unallocated",
        evidenceKey: "evidence",
        reportRevision: 1,
        reportedAt: "2026-11-03T12:00:00Z",
        reportingActor: { actorKind: "human", actorId: null },
        delta: {
          inputTokens: "90",
          outputTokens: "10",
          cachedInputTokens: "80",
          reasoningOutputTokens: "5",
          totalTokens: "100",
        },
        observation: {
          actor: { kind: "human", id: null },
          actorRole: "human",
          attribution: "unallocated",
          source: "codex-session-jsonl",
          harness: "Codex",
          harnessVersion: null,
          surface: "vscode",
          sessionId: "session",
          epoch: "epoch",
          evidenceId: "evidence",
          previousEvidenceId: "previous",
          provider: "openai",
          modelId: "model",
          scope: "session",
          reportKind: "cumulative_snapshot",
          quality: "measured",
          observedAt: "2026-11-03T11:59:00Z",
          periodStart: null,
          periodEnd: null,
          inputTokens: "900",
          outputTokens: "100",
          totalTokens: "1000",
          cachedInputTokens: "800",
          reasoningOutputTokens: "50",
          discovery: null,
        },
      },
    ],
  };
  setup("exact-summary", { usageReport: report });
  await userEvent.click(screen.getByRole("button", { name: /: 90%$/ }));
  expect(
    await screen.findByText("Status no momento do registro: Em revisão"),
  ).toBeVisible();
  expect(
    screen.getByText("Acumulado registrado de sessão (medido): 1.000 tokens"),
  ).toBeVisible();
  expect(
    screen.getByText("Delta registrado (medido): 100 tokens"),
  ).toBeVisible();
  expect(
    screen.getByText("Não incluído no total atribuído à tarefa."),
  ).toBeVisible();
});

it("does not borrow evidence from a different summary returned by a stale adapter", async () => {
  setup("missing-summary", {
    statusObserved: { id: "done", name: "Concluído", isDone: true },
  });
  await userEvent.click(screen.getByRole("button", { name: /: 90%$/ }));
  expect(
    await screen.findByText("Resumo vinculado indisponível."),
  ).toBeVisible();
  expect(
    screen.queryByText(/Status no momento do registro: Concluído/),
  ).toBeNull();
});
