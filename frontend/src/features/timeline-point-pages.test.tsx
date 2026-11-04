import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import {
  TimelinePointPages,
  inspectPointPages,
  type PointPage,
} from "./timeline-point-pages";
const point = (sequence: number) => ({
  id: `event-${sequence}`,
  taskId: "task",
  type: "comment.created" as const,
  occurredAt: "2026-11-03T12:00:00Z",
  sequence,
});
const page = (offset: number, total: number, count: number): PointPage => ({
  items: Array.from({ length: count }, (_, i) => point(offset + i)),
  offset,
  total,
  limit: 100,
  hasMore: offset + count < total,
  nextOffset: offset + count < total ? offset + count : null,
});
it("aborts the previous task request and never carries its points into another task", async () => {
  let signalA: AbortSignal | undefined;
  let finishA!: (value: PointPage) => void;
  const fetchA = vi.fn(async (_offset: number, signal: AbortSignal) => {
    signalA = signal;
    return await new Promise<PointPage>((resolve) => {
      finishA = resolve;
    });
  });
  const fetchB = vi.fn(async () => ({
    ...page(0, 1, 1),
    items: [{ ...point(1), id: "task-b-event", taskId: "task-b" }],
  }));
  const api = createMockApi({ delay: 0 });
  const view = (taskId: string, fetchPage: typeof fetchA | typeof fetchB) => (
    <ApiProvider api={api}>
      <TimelinePointPages taskId={taskId} version={1} fetchPage={fetchPage}>
        {(rows) => (
          <output aria-label="IDs">
            {rows.map((row) => row.id).join(",")}
          </output>
        )}
      </TimelinePointPages>
    </ApiProvider>
  );
  const { rerender } = render(view("task-a", fetchA));
  await waitFor(() => expect(fetchA).toHaveBeenCalledOnce());
  rerender(view("task-b", fetchB));
  await waitFor(() =>
    expect(screen.getByLabelText("IDs")).toHaveTextContent("task-b-event"),
  );
  expect(signalA?.aborted).toBe(true);
  finishA(page(0, 1, 1));
  await waitFor(() =>
    expect(screen.getByLabelText("IDs")).not.toHaveTextContent("event-0"),
  );
});
function renderPages(
  fetchPage: (offset: number, signal: AbortSignal) => Promise<PointPage>,
) {
  return render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <TimelinePointPages taskId="task" version={1} fetchPage={fetchPage}>
        {(rows) => <output aria-label="Pontos">{rows.length}</output>}
      </TimelinePointPages>
    </ApiProvider>,
  );
}
it("automatically reads every page without scrolling or a load-more button", async () => {
  const fetch = vi.fn(async (offset: number) =>
    page(offset, 205, Math.min(100, 205 - offset)),
  );
  renderPages(fetch);
  await waitFor(() =>
    expect(screen.getByLabelText("Pontos")).toHaveTextContent("205"),
  );
  expect(fetch.mock.calls.map(([offset]) => offset)).toEqual([0, 100, 200]);
  expect(screen.queryByRole("button", { name: /Carregar mais/ })).toBeNull();
  expect(screen.queryByText(/Histórico parcial/)).toBeNull();
});
it("keeps partial coverage explicit on a later-page failure and retries without losing earlier points", async () => {
  let fail = true;
  const fetch = vi.fn(async (offset: number) => {
    if (offset && fail) throw new Error("Conexão interrompida");
    return page(offset, 2, 1);
  });
  renderPages(fetch);
  expect(await screen.findByText(/Conexão interrompida/)).toBeVisible();
  expect(screen.getByText(/Histórico parcial/)).toBeVisible();
  expect(screen.getByLabelText("Pontos")).toHaveTextContent("1");
  fail = false;
  await userEvent.click(
    screen.getByRole("button", { name: /Tentar novamente/ }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Pontos")).toHaveTextContent("2"),
  );
});
it("accepts genuinely empty complete history", () => {
  expect(inspectPointPages([page(0, 0, 0)])).toMatchObject({
    rows: [],
    complete: true,
  });
});
it.each([
  ["repeated IDs", [page(0, 2, 1), { ...page(1, 2, 1), items: [point(0)] }]],
  ["changed total", [page(0, 2, 1), page(1, 3, 1)]],
  [
    "truncated final page",
    [{ ...page(0, 2, 1), hasMore: false, nextOffset: null }],
  ],
  ["offset gap", [page(0, 3, 1), page(2, 3, 1)]],
  ["non-advancing nextOffset", [{ ...page(0, 2, 1), nextOffset: 0 }]],
  ["descending sequence", [{ ...page(0, 2, 2), items: [point(2), point(1)] }]],
] as [string, PointPage[]][])(
  "rejects %s without claiming complete",
  (_name, pages) => {
    const result = inspectPointPages(pages);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.complete).toBe(false);
  },
);
