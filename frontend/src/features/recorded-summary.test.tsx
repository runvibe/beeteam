import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { RecordedSummary } from "./recorded-summary";
it("retrieves an explicit boundary summary by UUID without a timestamp join", async () => {
  const api = createMockApi({ delay: 0 });
  const row = {
    ...makeSeed().summaries[0],
    id: "boundary",
    summary: "Resumo da fronteira",
  };
  const list = vi
    .spyOn(api, "list")
    .mockResolvedValueOnce({
      items: [{ ...row, id: "other", summary: "Outro resumo" }],
      total: 2,
      limit: 1,
      offset: 0,
      hasMore: true,
      nextOffset: 1,
    })
    .mockResolvedValueOnce({
      items: [row],
      total: 2,
      limit: 1,
      offset: 1,
      hasMore: false,
      nextOffset: null,
    });
  render(
    <ApiProvider api={api}>
      <RecordedSummary taskId="task" summaryId="boundary" />
    </ApiProvider>,
  );
  expect(list).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Abrir resumo" }));
  expect(await screen.findByText("Resumo da fronteira")).toBeVisible();
  expect(screen.queryByText("Outro resumo")).toBeNull();
  expect(list).toHaveBeenLastCalledWith(
    "summaries",
    "task",
    expect.objectContaining({ offset: 1 }),
    expect.any(AbortSignal),
  );
  expect(list.mock.calls[0][2]?.createdFrom).toBeUndefined();
});
