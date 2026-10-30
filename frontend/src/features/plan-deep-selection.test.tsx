import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { Plans } from "./plans";
import { planRevealOffset } from "./plan-reveal";

afterEach(() => vi.unstubAllGlobals());
it.each([0, 12, 20])(
  "locates deep selection %s in actual order using bounded pages, including a fresh mount",
  async (index) => {
    const seed = makeSeed();
    seed.plans = Array.from({ length: 21 }, (_, i) => ({
      ...seed.plans[0],
      id: uuid(4000 + i),
      planId: uuid(4100 + i),
      title: `Real ${i}`,
      revision: 1,
      content: `Documento real ${i}`,
    }));
    window.history.replaceState(
      {},
      "",
      `/tasks/${seed.tasks[0].id}?tab=plans&plans.limit=5&plans.selected=${seed.plans[index].planId}`,
    );
    const api = createMockApi({ delay: 1, seed });
    const list = vi.spyOn(api, "list");
    const draw = () => (
      <ApiProvider api={api}>
        <Plans task={seed.tasks[0]} />
      </ApiProvider>
    );
    const view = render(draw());
    const check = async () => {
      const nav = await screen.findByRole("navigation", {
        name: "Planos disponíveis",
      });
      const selected = await within(nav).findByRole("button", {
        name: `Real ${index}`,
      });
      const rows = within(nav).getAllByRole("button");
      expect(rows.indexOf(selected)).toBe(index);
      expect(
        rows.filter((row) => row.textContent === `Real ${index}`),
      ).toHaveLength(1);
      expect(rows.map((row) => row.textContent)).toEqual(
        seed.plans.slice(0, rows.length).map((plan) => plan.title),
      );
      expect(
        list.mock.calls
          .filter((call) => call[0] === "plans")
          .every((call) => call[2]?.limit === 5),
      ).toBe(true);
      expect(await screen.findByText(`Documento real ${index}`)).toBeVisible();
    };
    await check();
    view.unmount();
    render(draw());
    await check();
  },
);
it("clamps reveal to the available scroll range", () => {
  const list = document.createElement("nav"),
    row = document.createElement("button");
  list.scrollTop = 100;
  Object.defineProperty(list, "clientHeight", { value: 200 });
  Object.defineProperty(list, "scrollHeight", { value: 1000 });
  list.getBoundingClientRect = () => ({ top: 50 }) as DOMRect;
  row.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
  expect(planRevealOffset(list, row)).toEqual({ desired: 950, maximum: 800 });
});
it("does not pull the list back after manual scrolling and reveals again on browser return", async () => {
  const seed = makeSeed();
  seed.plans = Array.from({ length: 3 }, (_, i) => ({
    ...seed.plans[0],
    id: uuid(4200 + i),
    planId: uuid(4300 + i),
    title: `Plano estável ${i}`,
    revision: 1,
  }));
  window.history.replaceState(
    {},
    "",
    `/tasks/${seed.tasks[0].id}?tab=plans&plans.selected=${seed.plans[1].planId}`,
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0, seed })}>
      <Plans task={seed.tasks[0]} />
    </ApiProvider>,
  );
  const nav = await screen.findByRole("navigation", {
    name: "Planos disponíveis",
  });
  await within(nav).findByRole("button", { name: "Plano estável 1" });
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  fireEvent.wheel(nav);
  nav.scrollTop = 123;
  fireEvent.scroll(nav);
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  expect(nav.scrollTop).toBe(123);
  await act(async () => {
    window.history.pushState(
      {},
      "",
      `/tasks/${seed.tasks[0].id}?tab=plans&plans.selected=${seed.plans[2].planId}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitFor(() =>
    expect(
      within(nav).getByRole("button", { name: "Plano estável 2" }),
    ).toHaveAttribute("aria-current", "page"),
  );
  await act(async () => {
    window.history.replaceState(
      {},
      "",
      `/tasks/${seed.tasks[0].id}?tab=plans&plans.selected=${seed.plans[1].planId}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitFor(() =>
    expect(
      within(nav).getByRole("button", { name: "Plano estável 1" }),
    ).toHaveAttribute("aria-current", "page"),
  );
});

it("cancels an in-flight locating page when the selected plan changes", async () => {
  const seed = makeSeed();
  seed.plans = Array.from({ length: 21 }, (_, i) => ({
    ...seed.plans[0],
    id: uuid(4400 + i),
    planId: uuid(4500 + i),
    title: `Cancel ${i}`,
    revision: 1,
  }));
  const api = createMockApi({ delay: 0, seed });
  const original = api.list.bind(api);
  let pendingSignal: AbortSignal | undefined;
  const list = vi
    .spyOn(api, "list")
    .mockImplementation((resource, scope, filters, signal) => {
      if (resource === "plans" && filters?.offset === 5) {
        pendingSignal = signal;
        return new Promise<never>((_resolve, reject) =>
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        );
      }
      return original(resource, scope, filters, signal);
    });
  window.history.replaceState(
    {},
    "",
    `/tasks/${seed.tasks[0].id}?tab=plans&plans.limit=5&plans.selected=${seed.plans[20].planId}`,
  );
  render(
    <ApiProvider api={api}>
      <Plans task={seed.tasks[0]} />
    </ApiProvider>,
  );
  await waitFor(() => expect(pendingSignal).toBeDefined());
  await act(async () => {
    window.history.replaceState(
      {},
      "",
      `/tasks/${seed.tasks[0].id}?tab=plans&plans.limit=5&plans.selected=${seed.plans[0].planId}`,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitFor(() => expect(pendingSignal?.aborted).toBe(true));
  expect(
    list.mock.calls
      .filter((call) => call[0] === "plans")
      .map((call) => call[2]?.offset),
  ).toEqual([0, 5]);
  expect(
    await screen.findByRole("button", { name: "Cancel 0" }),
  ).toHaveAttribute("aria-current", "page");
});
