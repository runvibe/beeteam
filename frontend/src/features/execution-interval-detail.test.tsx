import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import {
  ExecutionIntervalRecord,
  ExecutionIntervalLookup,
} from "./execution-interval-record";
import { ExecutionEventDetail } from "./execution-event-detail";
import { interval, event, executionPage } from "./execution-fixtures";
it("keeps interval delta, boundary snapshots, partial amounts and previous revisions separate", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "executionIntervalRevisions").mockResolvedValue(
    executionPage([
      {
        id: "revision",
        version: 1,
        createdAt: interval.createdAt,
        updatedAt: interval.updatedAt,
        archivedAt: null,
        deletedAt: null,
        taskId: "task",
        intervalId: interval.id,
        revision: 1,
        reason: "Correção explícita",
        reportingActor: { actorKind: "human", actorId: null },
        interval: { ...interval, totalTokens: "500" },
      },
    ]),
  );
  render(
    <ApiProvider api={api}>
      <ExecutionIntervalRecord interval={interval} />
    </ApiProvider>,
  );
  expect(
    screen.getByText(/Tokens do intervalo: 600 · Parcial: Não informado/),
  ).toBeVisible();
  expect(screen.getByText(/não indicam divisão exata/)).toBeVisible();
  await userEvent.click(
    screen.getByText("Fronteiras e diferenças dos contadores"),
  );
  expect(
    screen.getByText(/Diferença calculada pela API: 600 tokens/),
  ).toBeVisible();
  expect(
    screen.getByText(/Acumulado registrado de sessão \(medido\): 1.000 tokens/),
  ).toBeVisible();
  expect(
    screen.getByText(/Acumulado registrado de sessão \(medido\): 1.600 tokens/),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Histórico de revisões" }),
  );
  await userEvent.click(
    await screen.findByText(/Revisão anterior 1 · Correção explícita/),
  );
  expect(
    screen.getByText(/Tokens do intervalo: 500 · Parcial: Não informado/),
  ).toBeVisible();
  expect(
    screen.getByText(/Tokens do intervalo: 600 · Parcial: Não informado/),
  ).toBeVisible();
});
it("keeps open intervals without a fabricated end, duration or final total", () => {
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <ExecutionIntervalRecord
        interval={{
          ...interval,
          state: "open",
          coverage: "open",
          endSummaryId: null,
          endObservedAt: null,
          endReceivedAt: null,
          observedDurationMs: null,
          totalTokens: null,
          partialTokens: "0",
        }}
      />
    </ApiProvider>,
  );
  expect(screen.getByText("Sem encerramento observado")).toBeVisible();
  expect(screen.getByText("Duração observada: Não informada")).toBeVisible();
  expect(
    screen.getByText(/Tokens do intervalo: Não informado · Parcial: 0/),
  ).toBeVisible();
});
it("does not invent a boundary or zero for finish while paused", async () => {
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <ExecutionEventDetail
        event={{
          ...event,
          action: "finish",
          intervalId: null,
          observedAt: null,
          evidence: [],
        }}
        onInterval={() => {}}
      />
    </ApiProvider>,
  );
  expect(await screen.findByText("Agente da execução:")).toBeVisible();
  expect(await screen.findByRole("button", { name: "Lia" })).toBeVisible();
  expect(screen.getByText("Fim")).toBeVisible();
  expect(screen.getByText(/Sem nova fronteira observada/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Ver intervalo" })).toBeNull();
  expect(screen.queryByText(/Acumulado registrado/)).toBeNull();
});
it("resolves the explicitly linked interval across pages instead of choosing by timestamp", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "executionIntervals")
    .mockResolvedValueOnce(
      executionPage([{ ...interval, id: "wrong", totalTokens: "999" }], 2, 20),
    )
    .mockResolvedValueOnce(executionPage([interval], 2));
  render(
    <ApiProvider api={api}>
      <ExecutionIntervalLookup
        taskId="task"
        intervalId="interval"
        version={1}
      />
    </ApiProvider>,
  );
  expect(await screen.findByText(/Tokens do intervalo: 600/)).toBeVisible();
  expect(screen.queryByText(/Tokens do intervalo: 999/)).toBeNull();
});
