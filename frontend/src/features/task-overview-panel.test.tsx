import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { App } from "@/App";
import { TaskOverviewPanel } from "./task-overview-panel";

it("drills into actual server-side child filters and includes archived children counted by the chart", async () => {
  const seed = makeSeed(),
    parent = seed.tasks[0],
    status = seed.statuses[0];
  seed.tasks = [
    parent,
    {
      ...parent,
      id: uuid(900),
      slug: "child-overview",
      title: "Child filtered",
      parentId: parent.id,
      statusId: status.id,
      archivedAt: parent.updatedAt,
    },
  ];
  const api = createMockApi({ delay: 0, seed }),
    list = vi.spyOn(api, "list");
  window.history.replaceState(
    {},
    "",
    `/tasks/${parent.id}?tab=overview&from=%2Fboards`,
  );
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: `${status.name}: 1 subtarefas` }),
  );
  await waitFor(() =>
    expect(
      list.mock.calls.some(
        ([resource, scope, filters]) =>
          resource === "tasks" &&
          scope === "" &&
          filters?.parentId === parent.id &&
          filters?.statusId === status.id &&
          filters?.includeArchived === true,
      ),
    ).toBe(true),
  );
  expect(new URLSearchParams(location.search).get("from")).toBe("/boards");
  expect(screen.getByRole("tab", { name: "Subtasks" })).toHaveFocus();
  expect(
    await screen.findByRole("button", { name: "Child filtered" }),
  ).toBeVisible();
});
it("labels missing summary provenance and omits absent next-step and decisions", async () => {
  const seed = makeSeed(),
    task = seed.tasks[0];
  task.currentSummary = "**Síntese real**";
  seed.timeline = [];
  const { container } = render(
    <ApiProvider api={createMockApi({ delay: 0, seed })}>
      <TaskOverviewPanel task={task} onTab={() => {}} />
    </ApiProvider>,
  );
  await screen.findByRole("heading", { name: "Subtarefas por status" });
  const summary = container.querySelector(
    ".task-summary-section",
  ) as HTMLElement;
  expect(within(summary).getByText("Síntese real").tagName).toBe("STRONG");
  expect(within(summary).getByText(/Autoria e data/)).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Próximo passo registrado" }),
  ).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Decisões registradas" }),
  ).toBeNull();
});
