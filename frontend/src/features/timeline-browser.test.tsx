import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { TaskRecordList } from "./task-record-list";
import { SummaryBrowser } from "./summary-index";

it("selects a distant timeline ID through the API, preserves history and clears to the list", async () => {
  const seed = makeSeed();
  const task = seed.tasks[0];
  const event = {
    ...seed.timeline[0],
    id: "019a0000-0000-7000-8000-000000000099",
    taskId: task.id,
  };
  seed.timeline = [
    event,
    { ...event, id: "019a0000-0000-7000-8000-000000000098", sequence: 2 },
  ];
  window.history.replaceState(
    {},
    "",
    `/tasks/example?tab=timeline&timeline.selected=${event.id}`,
  );
  const api = createMockApi({ delay: 0, seed });
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <SummaryBrowser resource="timeline" taskId={task.id} progress={[]}>
        <TaskRecordList
          resource="timeline"
          scope={task.id}
          filters={{ limit: 10 }}
          empty="Vazio"
        >
          {(row) => <p>Card {row.id}</p>}
        </TaskRecordList>
      </SummaryBrowser>
    </ApiProvider>,
  );
  expect(await screen.findByText(`Card ${event.id}`)).toBeVisible();
  expect(screen.queryByText(`Card ${seed.timeline[1].id}`)).toBeNull();
  expect(list).toHaveBeenCalledWith(
    "timeline",
    task.id,
    expect.objectContaining({ id: event.id, offset: 0 }),
    expect.any(AbortSignal),
  );
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect(await screen.findByText(`Card ${seed.timeline[1].id}`)).toBeVisible();
  window.history.back();
  await waitFor(() => expect(location.search).toContain(event.id));
  await waitFor(() =>
    expect(screen.queryByText(`Card ${seed.timeline[1].id}`)).toBeNull(),
  );
});
