import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { TaskRecordList } from "./task-record-list";
import { navigate } from "@/routing/location";
import { SummaryBrowser, summaryTitle } from "./summary-index";
import { TaskFilterProvider } from "./task-filter-layout";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("derives a bounded plain title with date fallback", () => {
  expect(
    summaryTitle({
      summary: "\n# <img src=x> Texto\nOutro",
      createdAt: "2026-11-03T12:00:00Z",
    }),
  ).toBe("<img src=x> Texto");
  expect(
    summaryTitle({ summary: " ", createdAt: "2026-11-03T12:00:00Z" }),
  ).toMatch(/^Resumo de /);
  expect(
    summaryTitle({ summary: "a".repeat(200), createdAt: "" }).length,
  ).toBeLessThanOrEqual(100);
});
it("keeps a paginated index independent of selection and uses keyboard and standard clear", async () => {
  window.history.replaceState({}, "", "/tasks/example?tab=summaries");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: 60,
    height: 60,
    left: 0,
    right: 400,
    width: 400,
  } as DOMRect);

  const seed = makeSeed();
  const rows = Array.from({ length: 22 }, (_, i) => ({
    ...seed.summaries[0],
    id: uuid(900 + i),
    summary: `Resumo ${i}`,
    taskId: seed.tasks[0].id,
  }));
  seed.summaries = rows;
  const api = createMockApi({ delay: 0, seed });
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <TaskFilterProvider>
        <SummaryBrowser
          taskId={seed.tasks[0].id}
          progress={[{ summaryId: rows[0].id, percent: 0 }]}
        >
          <p>Cards</p>
        </SummaryBrowser>
      </TaskFilterProvider>
    </ApiProvider>,
  );
  const index = await screen.findByRole("complementary", {
    name: "Índice dos resumos",
  });
  const first = await within(index).findByRole("button", { name: /Resumo 0 / });
  expect(within(first).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  expect(
    within(index).getByRole("button", { name: /Resumo 1 / }),
  ).toHaveTextContent("Sem progresso vinculado");
  expect(
    screen.queryByRole("button", { name: "Carregar mais resumos" }),
  ).toBeNull();
  const last = await within(index).findByRole("button", { name: /Resumo 21 / });
  last.focus();
  await userEvent.keyboard("{Enter}");
  expect(new URLSearchParams(location.search).get("summaries.selected")).toBe(
    rows[21].id,
  );
  expect(first).toBeVisible();
  expect(list.mock.calls.map((call) => call[2]?.offset)).toEqual([0, 20]);
  expect(list.mock.calls.every((call) => !call[2]?.id)).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: /Limpar filtros/ }));
  expect(new URLSearchParams(location.search).has("summaries.selected")).toBe(
    false,
  );
});

it("filters distant summaries, restores history and isolates rapid stale responses", async () => {
  window.history.replaceState({}, "", "/tasks/example?summaries.selected=old");
  const api = createMockApi({ delay: 0 });
  const row = makeSeed().summaries[0];
  let resolveOld!: (value: unknown) => void;
  let oldSignal: AbortSignal | undefined;
  const list = vi
    .spyOn(api, "list")
    .mockImplementation(async (_r, _s, f, signal) => {
      if (f?.id === "old") {
        oldSignal = signal;
        return (await new Promise((resolve) => {
          resolveOld = resolve;
        })) as never;
      }
      if (f?.id === "error") throw new Error("Falha de consulta");
      return {
        items:
          f?.id === "missing"
            ? []
            : [{ ...row, id: f?.id || "all", summary: f?.id || "all" }],
        offset: 0,
        limit: 10,
        total: f?.id === "missing" ? 0 : 1,
        hasMore: false,
        nextOffset: null,
      } as never;
    });
  render(
    <ApiProvider api={api}>
      <TaskRecordList
        resource="summaries"
        scope="task"
        filters={{ limit: 10 }}
        empty="Vazio"
      >
        {(r) => <p>{r.summary}</p>}
      </TaskRecordList>
    </ApiProvider>,
  );
  await waitFor(() => expect(oldSignal).toBeDefined());
  act(() => navigate("/tasks/example?summaries.selected=new"));
  await screen.findByText("new");
  expect(oldSignal?.aborted).toBe(true);
  await act(async () =>
    resolveOld({
      items: [{ ...row, summary: "old" }],
      offset: 0,
      limit: 10,
      total: 1,
      hasMore: false,
      nextOffset: null,
    }),
  );
  expect(screen.queryByText("old")).toBeNull();
  act(() => navigate("/tasks/example"));
  await screen.findByText("all");
  act(() => window.history.back());
  await screen.findByText("new");
  act(() => window.history.forward());
  await screen.findByText("all");
  act(() => navigate("/tasks/example?summaries.selected=missing"));
  await screen.findByText("Resumo não encontrado nesta tarefa.");
  expect(screen.queryByText("all")).toBeNull();
  act(() => navigate("/tasks/example?summaries.selected=error"));
  await screen.findByRole("alert");
  expect(list.mock.calls.every((call) => call[2]?.offset === 0)).toBe(true);
});
it("mock combines summary identity with task scope and hides deleted records", async () => {
  const seed = makeSeed();
  const row = seed.summaries[0];
  const api = createMockApi({ delay: 0, seed });
  expect(
    (await api.list("summaries", row.taskId, { id: row.id })).items.map(
      (r) => r.id,
    ),
  ).toEqual([row.id]);
  expect((await api.list("summaries", uuid(9999), { id: row.id })).total).toBe(
    0,
  );
  seed.summaries[0].deletedAt = new Date().toISOString();
  expect(
    (
      await createMockApi({ delay: 0, seed }).list("summaries", row.taskId, {
        id: row.id,
      })
    ).total,
  ).toBe(0);
});

it("uses the internal root, stops at errors and retries without duplicating rows", async () => {
  let intersect = () => {};
  let observedRoot: Element | Document | null | undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: IntersectionObserverCallback,
        options: IntersectionObserverInit,
      ) {
        observedRoot = options.root;
        intersect = () =>
          callback(
            [{ isIntersecting: true }] as IntersectionObserverEntry[],
            {} as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
  const api = createMockApi({ delay: 0 });
  const row = makeSeed().summaries[0];
  let attempts = 0;
  const list = vi.spyOn(api, "list").mockImplementation(async (_r, _s, f) => {
    const offset = f?.offset ?? 0;
    if (offset && ++attempts === 1) throw new Error("Page failed");
    return {
      items: offset
        ? [
            { ...row, id: "first", summary: "Primeiro" },
            { ...row, id: "last", summary: "Último" },
          ]
        : [{ ...row, id: "first", summary: "Primeiro" }],
      offset,
      limit: 20,
      total: 2,
      hasMore: !offset,
      nextOffset: offset ? null : 20,
    } as never;
  });
  render(
    <ApiProvider api={api}>
      <SummaryBrowser taskId="task" progress={[]}>
        <p>Cards</p>
      </SummaryBrowser>
    </ApiProvider>,
  );
  const first = await screen.findByRole("button", { name: /Primeiro/ });
  expect(observedRoot).toBe(document.querySelector(".summary-index-items"));
  act(() => intersect());
  await screen.findByRole("alert");
  act(() => {
    intersect();
    intersect();
  });
  expect(list).toHaveBeenCalledTimes(2);
  expect(first).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: /Tentar novamente/ }),
  );
  await screen.findByRole("button", { name: /Último/ });
  act(() => intersect());
  expect(list.mock.calls.map((call) => call[2]?.offset)).toEqual([0, 20, 20]);
  expect(screen.getAllByRole("button", { name: /Primeiro/ })).toHaveLength(1);
});

it("cancels the index request on task change without replacing the new index", async () => {
 const api=createMockApi({delay:0}); const row=makeSeed().summaries[0];
 let signal: AbortSignal | undefined; let finish!: (value:unknown)=>void;
 vi.spyOn(api,"list").mockImplementation(async (_r,scope,_f,abort)=>{
   if(scope==="old") { signal=abort; return await new Promise(resolve=>{finish=resolve;}) as never; }
   return {items:[{...row,id:"new",summary:"Novo índice"}],offset:0,limit:20,total:1,hasMore:false,nextOffset:null} as never;
 });
 const draw=(taskId:string)=><ApiProvider api={api}><SummaryBrowser taskId={taskId} progress={[]}><p>Cards</p></SummaryBrowser></ApiProvider>;
 const view=render(draw("old")); await waitFor(()=>expect(signal).toBeDefined());
 view.rerender(draw("new")); await screen.findByRole("button",{name:/Novo índice/});
 expect(signal?.aborted).toBe(true);
 await act(async()=>finish({items:[{...row,summary:"Índice antigo"}],offset:0,limit:20,total:1,hasMore:false,nextOffset:null}));
 expect(screen.queryByRole("button",{name:/Índice antigo/})).toBeNull();
});
