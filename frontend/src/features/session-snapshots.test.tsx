import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SummaryUsageReport } from "@/api/generated/kanban/SummaryUsageReport";
import { SessionSnapshots } from "./session-snapshots";
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

it("shows authoritative snapshots after baseline independently per session and tree with observation metadata", () => {
  const r = report();
  const entry = r.entries[0];
  entry.coverageReason = "shared_or_unallocated";
  entry.delta = {
    inputTokens: "1",
    outputTokens: "1",
    totalTokens: "2",
    cachedInputTokens: null,
    reasoningOutputTokens: null,
  };
  entry.observation.totalTokens = "9007199254740993";
  entry.observation.inputTokens = null;
  entry.observation.outputTokens = null;
  r.entries.push({
    ...entry,
    id: "tree",
    observation: {
      ...entry.observation,
      scope: "session_tree",
      sessionId: "tree-session",
      totalTokens: "9007199254740995",
    },
  });
  const { container } = render(<SessionSnapshots report={r} />);
  expect(
    screen.getByText(
      "Acumulado registrado de sessão (medido): 9.007.199.254.740.993 tokens",
    ),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Acumulado registrado de sessão e descendentes (medido): 9.007.199.254.740.995 tokens",
    ),
  ).toBeVisible();
  expect(screen.getByText("Model A · Sessão tree-session")).toBeVisible();
  expect(container.querySelectorAll("time")).toHaveLength(2);
  expect(container.querySelector("time")).toHaveAttribute(
    "datetime",
    entry.observation.observedAt,
  );
  expect(screen.queryByText(/18.014.398.509.481.988/)).toBeNull();
  expect(screen.queryByText(/Registro legado/)).toBeNull();
});
it("retains explicit zero and legacy missing totals without fabricating a value", () => {
  const r = report();
  r.entries[0].observation.totalTokens = "0";
  const { rerender } = render(<SessionSnapshots report={r} />);
  expect(screen.getByText(/\(medido\): 0 tokens/)).toBeVisible();
  delete r.entries[0].observation.totalTokens;
  rerender(<SessionSnapshots report={r} />);
  expect(screen.getByText(/999.999 tokens/)).toBeVisible();
  expect(screen.getByText(/Registro legado/)).toBeVisible();
  r.entries[0].observation.inputTokens = null;
  rerender(<SessionSnapshots report={r} />);
  expect(screen.getByText(/Não informado tokens/)).toBeVisible();
});
