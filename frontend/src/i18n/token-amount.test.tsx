import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { setLocalePreference } from "./index";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { SessionSnapshot } from "@/features/session-snapshots";
import { UsageCheckpointPoint } from "@/features/usage-checkpoint-point";
import { ProgressSummary } from "@/features/progress-summary";
import { ExecutionIntervalDetail } from "@/features/execution-interval-detail";
import { evidence, interval } from "@/features/execution-fixtures";
const amounts = [
  ["0", "0 tokens", "0 tokens"],
  ["1", "1 token", "1 token"],
  ["2", "2 tokens", "2 tokens"],
  [
    "9007199254740993123456789",
    "9,007,199,254,740,993,123,456,789 tokens",
    "9.007.199.254.740.993.123.456.789 tokens",
  ],
] as const;
for (const language of ["en", "pt"] as const) {
  it.each(amounts)(
    `renders exact cumulative token amounts in ${language}: %s`,
    (amount, en, pt) => {
      setLocalePreference(language);
      const observation = evidence("amount", amount).observation;
      observation.actor = { kind: "human", id: null };
      render(<SessionSnapshot observation={observation} />);
      const prefix =
        language === "en"
          ? "Recorded cumulative usage of session (measured): "
          : "Acumulado registrado de sessão (medido): ";
      expect(
        screen.getByText(prefix + (language === "en" ? en : pt)),
      ).toBeVisible();
    },
  );
  it(`uses singular token amounts in checkpoint accessibility, progress deltas and interval boundaries (${language})`, async () => {
    setLocalePreference(language);
    const seed = makeSeed(),
      summary = seed.summaries[0];
    const entry = evidence("single", "1");
    entry.delta = {
      inputTokens: "1",
      outputTokens: "0",
      cachedInputTokens: null,
      reasoningOutputTokens: null,
      totalTokens: "1",
    };
    const report = {
      reportedAt: summary.createdAt,
      reportingActor: { actorKind: "human", actorId: null } as const,
      statusObserved: null,
      revision: 1,
      entries: [entry],
    };
    summary.usageReport = report;
    const point = {
      summaryId: summary.id,
      reportedAt: summary.createdAt,
      reportingActor: report.reportingActor,
      statusObserved: null,
      usageReport: null,
      recordedSessionUsage: {
        measuredTotalTokens: "1",
        estimatedTotalTokens: "1",
        coverage: {
          sessions: 1,
          baselineEntries: 0,
          deltaEntries: 1,
          duplicateEntries: 0,
        },
      },
    };
    const localInterval = structuredClone(interval);
    localInterval.counters[0].segments[0].delta = entry.delta;
    render(
      <ApiProvider api={createMockApi({ seed, delay: 0 })}>
        <UsageCheckpointPoint
          point={point}
          position={{ x: 40, y: 40 }}
          selected={false}
          detailId="single"
          onSelect={() => {}}
        />
        <ProgressSummary taskId={summary.taskId} summaryId={summary.id} />
        <ExecutionIntervalDetail interval={localInterval} />
      </ApiProvider>,
    );
    expect(
      screen.getByRole("button", {
        name:
          language === "en"
            ? /Summary .*: 1 token; status/
            : /Resumo .*: 1 token; status/,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        language === "en"
          ? "Recorded delta (measured): 1 token"
          : "Delta registrado (medido): 1 token",
      ),
    ).toBeVisible();
    await userEvent.click(
      screen.getByText(
        language === "en"
          ? "Counter boundaries and differences"
          : "Fronteiras e diferenças dos contadores",
      ),
    );
    expect(
      screen.getByText(
        language === "en"
          ? "Difference calculated by the API: 1 token"
          : "Diferença calculada pela API: 1 token",
      ),
    ).toBeVisible();
  });
}
