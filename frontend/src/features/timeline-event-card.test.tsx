import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import type { Resources } from "@/api/types";
import { TimelineEventCard } from "./timeline-event-card";
import { executionPage } from "./execution-fixtures";

it("keeps source task attribution and execution synthesis separate from the referenced summary", async () => {
  const api = createMockApi({ delay: 0 });
  render(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("execution.recorded", {
          executionSummaryId: "summary",
          currentSummary: "Síntese acumulada histórica",
          previousCurrentSummary: "Síntese anterior histórica",
          progress: { percent: 35, note: "Progresso registrado" },
        })}
      />
    </ApiProvider>,
  );
  expect(screen.getByText("Síntese acumulada histórica")).toBeVisible();
  expect(screen.getByText("Síntese anterior histórica")).toBeVisible();
  expect(screen.getByText("35%")).toBeVisible();
  expect(screen.getByText(/Tarefa de origem:/)).toHaveTextContent("task");
});

it("shows removed attachment metadata and full description without enabling download", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "list").mockResolvedValue(
    executionPage([
      {
        ...makeSeed().attachments[0],
        id: "file",
        taskId: "task",
        originalName: "evidence.md",
        mediaType: "text/markdown",
        sizeBytes: 123,
        description: "Descrição **preservada**",
        deletedAt: "2026-11-01T00:00:00Z",
      },
    ]) as never,
  );
  render(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("attachment.removed", { attachmentId: "file" })}
      />
    </ApiProvider>,
  );
  expect(await screen.findByText("evidence.md")).toBeVisible();
  expect(screen.getByText("preservada")).toBeVisible();
  expect(screen.getByRole("button", { name: /Baixar arquivo/ })).toBeDisabled();
});
it("keeps absent legacy references explicit and renders task creation/assignment metadata", async () => {
  const api = createMockApi({ delay: 0 });
  const { rerender } = render(
    <ApiProvider api={api}>
      <TimelineEventCard event={event("plan.revised", {})} />
    </ApiProvider>,
  );
  expect(
    await screen.findByText(/Conteúdo referenciado indisponível/),
  ).toBeVisible();
  rerender(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("subtask.created", {
          parentId: "parent",
          coordinationContext: { reason: "Trabalho dividido" },
        })}
      />
    </ApiProvider>,
  );
  expect(screen.getByText("Trabalho dividido")).toBeVisible();
  expect(screen.getByText("parent")).toBeVisible();
  rerender(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("assignment.changed", {
          executorAgentId: makeSeed().agents[0].id,
          previousExecutorAgentId: null,
        })}
      />
    </ApiProvider>,
  );
  expect(await screen.findByText(makeSeed().agents[0].name)).toBeVisible();
  expect(screen.getByText("Executor anterior")).toBeVisible();
});

function event(
  type: string,
  data: Record<string, unknown>,
): Resources["timeline"] {
  return {
    ...makeSeed().timeline[0],
    type,
    data,
    taskId: "task",
    actorKind: "human",
    actorId: null,
  } as Resources["timeline"];
}
it("renders a real comment as Markdown inside the same Card composition used by summaries", async () => {
  const api = createMockApi({ delay: 0 });
  const comment = vi.spyOn(api, "comment").mockResolvedValue({
    ...makeSeed().comments[0],
    id: "comment",
    taskId: "task",
    body: "## Decisão\n\nConteúdo **completo**\n\n[Não executar](javascript:alert(1))",
  });
  const { container } = render(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("comment.created", { commentId: "comment" })}
      />
    </ApiProvider>,
  );
  expect(await screen.findByRole("heading", { name: "Decisão" })).toBeVisible();
  expect(screen.getByText("completo").tagName).toBe("STRONG");
  expect(
    container.querySelector('[data-slot="card"] [data-slot="card-header"]'),
  ).not.toBeNull();
  expect(container.querySelector('[data-slot="card-content"]')).not.toBeNull();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(comment).toHaveBeenCalledWith(
    "task",
    "comment",
    expect.any(AbortSignal),
  );
});
it("renders only changed fields with historical before and after, preserving zero, false, and long Markdown", () => {
  const api = createMockApi({ delay: 0 });
  render(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("task.updated", {
          previous: {
            progress: { percent: 0, note: "Anterior" },
            title: "Não alterado",
            currentSummary: "Síntese antiga",
          },
          changes: {
            progress: { percent: 75, note: "Nova **nota**" },
            currentSummary: "## Resultado\n\nSíntese completa",
          },
        })}
      />
    </ApiProvider>,
  );
  expect(screen.getByText("0%")).toBeVisible();
  expect(screen.getByText("75%")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Resultado" })).toBeVisible();
  expect(screen.queryByText("Não alterado")).toBeNull();
});
it("loads the exact historical plan revision across pages, never the latest revision", async () => {
  const api = createMockApi({ delay: 0 });
  const base = { ...makeSeed().plans[0], taskId: "task", planId: "plan" };
  vi.spyOn(api, "revisions").mockImplementation(
    async (_task, _plan, filters) =>
      filters?.offset
        ? executionPage([
            {
              ...base,
              id: "old",
              revision: 1,
              content: "Plano **original**",
              title: "Planejamento",
            },
          ])
        : {
            ...executionPage([
              { ...base, id: "new", revision: 2, content: "Não mostrar" },
            ]),
            hasMore: true,
            nextOffset: 1,
          },
  );
  render(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("plan.created", {
          planId: "plan",
          revisionId: "old",
          revision: 1,
        })}
      />
    </ApiProvider>,
  );
  expect(await screen.findByText("original")).toBeVisible();
  expect(screen.queryByText("Não mostrar")).toBeNull();
});
it("does not substitute a foreign comment and shows unavailable referenced content", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "comment").mockResolvedValue({
    ...makeSeed().comments[0],
    id: "comment",
    taskId: "foreign",
    body: "Wrong task",
  });
  render(
    <ApiProvider api={api}>
      <TimelineEventCard
        event={event("comment.created", { commentId: "comment" })}
      />
    </ApiProvider>,
  );
  expect(
    await screen.findByText(/Conteúdo referenciado indisponível/),
  ).toBeVisible();
  expect(screen.queryByText("Wrong task")).toBeNull();
});
it.each([
  [
    "block.changed",
    {
      previous: { blocked: false, reason: null },
      block: { blocked: true, reason: "Aguardando **contrato**" },
    },
    "contrato",
  ],
  ["task.archived", { archived: true }, "Sim"],
  ["task.restored", { archived: false }, "Não"],
  [
    "position.changed",
    { beforeTaskId: null, currentSummary: "Síntese registrada" },
    "Síntese registrada",
  ],
  [
    "future.event",
    { message: "Informação preservada", count: 0 },
    "Informação preservada",
  ],
])(
  "renders readable %s fields without requiring a modal",
  async (type, data, label) => {
    const api = createMockApi({ delay: 0 });
    render(
      <ApiProvider api={api}>
        <TimelineEventCard event={event(type, data)} />
      </ApiProvider>,
    );
    expect(within(screen.getByRole("article")).getByText(label)).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  },
);
