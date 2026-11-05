import { act, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids, makeSeed } from "@/api/seed";
import { setLocalePreference } from "@/i18n";
import { TimelineEventCard } from "./timeline-event-card";
import { OverviewActivity } from "./overview-artifacts";
import { eventLabels, eventTitle } from "./timeline-labels";

const audit = {
  linkedTaskId: "linked-task-id",
  previousParentId: null,
  parentId: "new-parent-id",
  previousExecutionContext: {
    rootTaskId: "old-root-id",
    originBoardId: "old-board-id",
    originBoardMode: "manual",
    effectiveMode: "manual",
  },
  executionContext: {
    rootTaskId: "new-root-id",
    originBoardId: "new-board-id",
    originBoardMode: "automatic",
    effectiveMode: "automatic",
  },
  coordinationContext: {
    mode: "manual",
    conversationRef: "User-authored **reference**",
    approvalRef: "human approval",
  },
};
const event = {
  ...makeSeed().timeline[0],
  type: "task.parent_changed" as const,
  data: audit,
};

it("renders parent-link history in EN/PT without replacing nulls, IDs or historical contexts", () => {
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <TimelineEventCard event={event} />
    </ApiProvider>,
  );
  const card = screen.getByRole("article", {
    name: /Vínculo da tarefa alterado/,
  });
  expect(within(card).getByText("Tarefa vinculada (ID)")).toBeVisible();
  expect(
    within(card).getByText("Tarefa principal anterior (ID)"),
  ).toBeVisible();
  expect(within(card).getByText("Contexto de execução anterior")).toBeVisible();
  expect(within(card).getByText("old-root-id")).toBeVisible();
  expect(within(card).getByText("new-root-id")).toBeVisible();
  expect(within(card).getAllByText("Automático")).toHaveLength(2);
  expect(card.querySelector("details pre")?.textContent).toBe(
    JSON.stringify(audit, null, 2),
  );
  act(() => setLocalePreference("en"));
  expect(screen.getByRole("article", { name: /Task link changed/ })).toBe(card);
  expect(within(card).getByText("Previous parent task ID")).toBeVisible();
  expect(within(card).getByText("Previous execution context")).toBeVisible();
  expect(within(card).getAllByText("Automatic")).toHaveLength(2);
  expect(eventTitle(event)).toContain("Task link changed");
  expect(eventLabels["task.created"]).toBe("Task created");
});

it("labels the same event in overview recent activity", async () => {
  const api = createMockApi({ delay: 0 });
  const overview = await api.overview(ids.task);
  const data = {
    ...overview,
    recentEvents: { ...overview.recentEvents, items: [event], total: 1 },
  };
  render(
    <ApiProvider api={api}>
      <OverviewActivity data={data} onTab={vi.fn()} />
    </ApiProvider>,
  );
  expect(screen.getByText("Vínculo da tarefa alterado")).toBeVisible();
  act(() => setLocalePreference("en"));
  expect(screen.getByText("Task link changed")).toBeVisible();
});
