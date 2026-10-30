import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { PlanHistory } from "./plan-history";

it("loads bounded history pages near the end, deduplicates concurrent triggers and stops at exhaustion", async () => {
  let enter: IntersectionObserverCallback = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        enter = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  try {
    const seed = makeSeed();
    const item = seed.plans[0];
    const api = createMockApi({ delay: 0, seed });
    const records = Array.from({ length: 12 }, (_, index) => ({
      ...item,
      id: uuid(900 + index),
      revision: 12 - index,
    }));
    const revisions = vi
      .spyOn(api, "revisions")
      .mockImplementation(async (_task, _plan, filters) => {
        const offset = filters?.offset ?? 0;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          items: records.slice(offset, offset + 5),
          offset,
          limit: 5,
          total: 12,
          hasMore: offset < 10,
          nextOffset: offset < 10 ? offset + 5 : null,
        };
      });
    render(
      <ApiProvider api={api}>
        <PlanHistory item={item} onSelect={() => {}} />
      </ApiProvider>,
    );
    await screen.findByRole("button", { name: "Ver revisão 8" });
    expect(revisions).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Ver revisão 7" })).toBeNull();
    const intersect = () =>
      enter(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    act(() => {
      intersect();
      intersect();
    });
    await screen.findByRole("button", { name: "Ver revisão 3" });
    expect(revisions).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    act(intersect);
    await screen.findByRole("button", { name: "Ver revisão 1" });
    expect(revisions).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole("button", { name: /Ver revisão/ })).toHaveLength(
      12,
    );
    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("isolates a pending response when switching plans and refreshes the history for a new current revision", async () => {
  const seed = makeSeed();
  const item = seed.plans[0];
  const other = { ...item, planId: uuid(990), id: uuid(991), revision: 99 };
  const api = createMockApi({ delay: 0, seed });
  let finish!: (value: Awaited<ReturnType<typeof api.revisions>>) => void;
  const page = (record: typeof item) => ({
    items: [record],
    offset: 0,
    limit: 5,
    total: 1,
    hasMore: false,
    nextOffset: null,
  });
  const revisions = vi
    .spyOn(api, "revisions")
    .mockImplementation(async (_task, plan) => {
      if (plan === item.planId)
        return new Promise((resolve) => {
          finish = resolve;
        });
      return page(other);
    });
  const draw = (record: typeof item) => (
    <ApiProvider api={api}>
      <PlanHistory item={record} onSelect={() => {}} />
    </ApiProvider>
  );
  const view = render(draw(item));
  await waitFor(() => expect(revisions).toHaveBeenCalledTimes(1));
  view.rerender(draw(other));
  await screen.findByRole("button", { name: "Ver revisão 99" });
  await act(async () => {
    finish(page(item));
  });
  expect(
    screen.queryByRole("button", { name: `Ver revisão ${item.revision}` }),
  ).toBeNull();
  view.rerender(draw({ ...other, revision: 100 }));
  await waitFor(() => expect(revisions).toHaveBeenCalledTimes(3));
});

it("keeps empty and retry states explicit", async () => {
  const seed = makeSeed();
  const api = createMockApi({ delay: 0, seed });
  vi.spyOn(api, "revisions")
    .mockRejectedValueOnce(new Error("Falha temporária"))
    .mockResolvedValue({
      items: [],
      offset: 0,
      limit: 5,
      total: 0,
      hasMore: false,
      nextOffset: null,
    });
  render(
    <ApiProvider api={api}>
      <PlanHistory item={seed.plans[0]} onSelect={() => {}} />
    </ApiProvider>,
  );
  await screen.findByText("Falha temporária");
  screen.getByRole("button", { name: "Tentar novamente" }).click();
  expect(await screen.findByText("Nenhuma revisão registrada")).toBeVisible();
});
