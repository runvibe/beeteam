import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { Plans } from "./plans";

afterEach(() => vi.unstubAllGlobals());
function setup(mobile = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("max-width") ? mobile : !mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const seed = makeSeed();
  seed.plans = Array.from({ length: 13 }, (_, i) => ({
    ...seed.plans[0],
    id: uuid(920 + i),
    planId: uuid(950 + i),
    title: `Plano ${i + 1}`,
    content: `Documento ${i + 1}`,
    revision: 1,
  }));
  window.history.replaceState(
    {},
    "",
    `/tasks/${seed.tasks[0].id}?tab=plans&plans.limit=5&from=%2Fboards`,
  );
  const api = createMockApi({ delay: 0, seed });
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <Plans task={seed.tasks[0]} />
    </ApiProvider>,
  );
  return { api, list, seed };
}
it("loads the desktop list only near its own end and keeps selection/from and history separate", async () => {
  let enter: IntersectionObserverCallback = () => {};
  let root: Element | Document | null | undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: IntersectionObserverCallback,
        options: IntersectionObserverInit,
      ) {
        enter = callback;
        root = options.root;
      }
      observe() {}
      disconnect() {}
    },
  );
  const { list } = setup();
  await screen.findByRole("button", { name: "Plano 5" });
  expect(
    screen.queryByRole("button", { name: "Plano 6" }),
  ).toBeNull();
  expect(root).toBe(
    screen.getByRole("navigation", { name: "Planos disponíveis" }),
  );
  act(() => {
    enter(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    enter(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  });
  await screen.findByRole("button", { name: "Plano 10" });
  expect(list.mock.calls.filter((call) => call[0] === "plans")).toHaveLength(2);
  await userEvent.click(
    screen.getByRole("button", { name: "Plano 8" }),
  );
  expect(await screen.findByText("Documento 8")).toBeVisible();
  expect(new URLSearchParams(location.search).get("from")).toBe("/boards");
  expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
});
it("uses mobile previous/next without looping, loads one page at the edge and restores each reading position", async () => {
  const { list } = setup(true);
  await screen.findByText("Documento 1");
  expect(
    screen.queryByRole("navigation", { name: "Planos disponíveis" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Plano anterior" })).toBeDisabled();
  const reading = screen.getByRole("region", { name: "Conteúdo do plano" });
  reading.scrollTop = 210;
  fireEvent.scroll(reading);
  await userEvent.click(screen.getByRole("button", { name: "Próximo plano" }));
  await screen.findByText("Documento 2");
  await userEvent.click(screen.getByRole("button", { name: "Plano anterior" }));
  await screen.findByText("Documento 1");
  expect(
    screen.getByRole("region", { name: "Conteúdo do plano" }).scrollTop,
  ).toBe(210);
  for (let i = 2; i <= 6; i++) {
    await userEvent.click(
      screen.getByRole("button", { name: "Próximo plano" }),
    );
    await screen.findByText(`Documento ${i}`);
  }
  expect(list.mock.calls.filter((call) => call[0] === "plans")).toHaveLength(2);
  expect(new URLSearchParams(location.search).get("from")).toBe("/boards");
});
it("selects the neighboring mobile page on horizontal snap without changing selection on vertical scrolling", async () => {
  setup(true);
  await screen.findByText("Documento 1");
  const carousel = screen.getByRole("region", { name: "Páginas dos planos" });
  Object.defineProperty(carousel, "clientWidth", { value: 320 });
  carousel.scrollLeft = 320;
  fireEvent.scroll(carousel);
  await screen.findByText("Documento 2");
  const url = location.href;
  fireEvent.scroll(screen.getByRole("region", { name: "Conteúdo do plano" }));
  await waitFor(() => expect(location.href).toBe(url));
});
