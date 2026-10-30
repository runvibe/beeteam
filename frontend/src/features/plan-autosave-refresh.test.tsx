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
import { TaskMode } from "./settings";

afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

it("keeps the plan list mounted and silent throughout autonomy autosave invalidation", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const seed = makeSeed(),
    task = seed.tasks[0];
  seed.plans = Array.from({ length: 21 }, (_, i) => ({
    ...seed.plans[0],
    id: uuid(9000 + i),
    planId: uuid(9100 + i),
    title: `Plano ${i}`,
    revision: 1,
  }));
  window.history.replaceState(
    {},
    "",
    `/tasks/${task.id}?tab=plans&plans.limit=100&plans.selected=${seed.plans[20].planId}`,
  );
  const api = createMockApi({ seed, delay: 0 });
  const list = api.list.bind(api);
  let holding = false,
    release!: () => void;
  const requests = vi
    .spyOn(api, "list")
    .mockImplementation(async (resource, scope, filters, signal) => {
      if (resource === "plans" && holding)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return list(resource, scope, filters, signal);
    });
  render(
    <ApiProvider api={api}>
      <TaskMode task={task} />
      <Plans task={task} />
    </ApiProvider>,
  );
  const nav = await screen.findByRole("navigation", {
    name: "Planos disponíveis",
  });
  const last = await within(nav).findByRole("button", { name: "Plano 20" });
  await act(async () => {
    await new Promise(requestAnimationFrame);
  });
  fireEvent.wheel(nav);
  nav.scrollTop = 137;
  holding = true;
  fireEvent.keyDown(
    screen.getByRole("combobox", { name: "Configuração individual" }),
    { key: "Enter" },
  );
  fireEvent.click(
    screen.getByRole("option", {
      name: task.autonomyMode === "manual" ? "Automático" : "Manual",
    }),
  );
  await waitFor(() =>
    expect(
      requests.mock.calls.filter((call) => call[0] === "plans"),
    ).toHaveLength(2),
  );
  expect(
    within(nav).queryByRole("status", { name: "Carregando planos" }),
  ).toBeNull();
  expect(within(nav).getAllByRole("button")).toHaveLength(21);
  expect(within(nav).getByRole("button", { name: "Plano 20" })).toBe(last);
  expect(last).toHaveAttribute("aria-current", "page");
  expect(nav.scrollTop).toBe(137);
  await act(async () => release());
  expect(screen.getByRole("navigation", { name: "Planos disponíveis" })).toBe(
    nav,
  );
  expect(within(nav).getByRole("button", { name: "Plano 20" })).toBe(last);
  expect(nav.scrollTop).toBe(137);
});
