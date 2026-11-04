import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { event, executionPage } from "./execution-fixtures";
import { TimelineExecutionDisclosure } from "./timeline-execution-detail";
it("loads complete event details inline by exact summary ID without scanning", async () => {
  const api = createMockApi({ delay: 0 });
  const fetch = vi
    .spyOn(api, "executionTrackingEvents")
    .mockResolvedValue(executionPage([event]));
  render(
    <ApiProvider api={api}>
      <TimelineExecutionDisclosure taskId="task" summaryId={event.summaryId} />
    </ApiProvider>,
  );
  expect(
    await screen.findByText("Em revisão histórica", { exact: false }),
  ).toBeVisible();
  expect(screen.getByText("Troca de tarefa")).toBeVisible();
  expect(screen.getByRole("button", { name: "Ver intervalo" })).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    "task",
    { summaryId: event.summaryId, offset: 0, limit: 1 },
    expect.any(AbortSignal),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
});
